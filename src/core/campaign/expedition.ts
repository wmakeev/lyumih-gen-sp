/**
 * Поток экспедиции (§12): старт, сетап боя (static/procedural), retry/abandon
 * (§6.8, §15), между боями (revive), финиш.
 */

import type { Rng } from '../rng'
import { SeededRng } from '../rng'
import type {
  CampaignState,
  Expedition,
  BattleAttemptSnapshot,
} from '../types/campaign'
import type { Character } from '../types/character'
import type { ContentRegistry, StaticScenario } from '../types/content'
import { buildBattleFromScenario } from './battle-setup'
import { startBattle } from '../battle/engine'
import { buildProceduralScenario } from './generators'

function deepClone<T>(v: T): T {
  return structuredClone(v)
}

function squadCharacters(c: CampaignState, exp: Expedition): Character[] {
  const out: Character[] = []
  for (const m of exp.squadSnapshot) {
    if (m.metaStatus === 'downed') continue
    const ch = c.characters.find((x) => x.id === m.characterId)
    if (ch) out.push(ch)
  }
  return out
}

/** Сценарий текущего боя цепочки (static — из реестра; procedural — генератор). */
export function currentScenario(
  c: CampaignState,
  registry: ContentRegistry,
): StaticScenario | null {
  const exp = c.expedition
  if (!exp) return null
  const mode = registry.expeditions.get(exp.scenarioChainId)
  if (!mode) return null
  if (mode.kind === 'static' && mode.scenarioChain) {
    const sid = mode.scenarioChain[exp.battleIndex]
    return sid ? registry.scenarios.get(sid) ?? null : null
  }
  if (mode.kind === 'procedural' && mode.generatorId) {
    return buildProceduralScenario(mode.generatorId, exp.generationSeed, exp.battleIndex, registry)
  }
  return null
}

function takeSnapshot(c: CampaignState, scenarioSlotIndex: number): BattleAttemptSnapshot {
  return {
    gold: c.gold,
    worldPower: c.worldPower,
    scenarioSlotIndex,
    characters: deepClone(c.characters),
    chest: deepClone(c.chest),
  }
}

/** Сетап текущего боя экспедиции: строит battle и снимок попытки. */
export function setupCurrentBattle(
  c: CampaignState,
  registry: ContentRegistry,
  rng: Rng,
): { ok: boolean; excluded: string[]; reason?: string } {
  const exp = c.expedition
  if (!exp) return { ok: false, excluded: [], reason: 'нет экспедиции' }
  const scenario = currentScenario(c, registry)
  if (!scenario) return { ok: false, excluded: [], reason: 'нет сценария' }

  const squad = squadCharacters(c, exp)
  if (squad.length === 0) return { ok: false, excluded: [], reason: 'нет бойцов' }

  c.battleAttemptSnapshot = takeSnapshot(c, exp.battleIndex)
  c.battleAttemptId += 1

  const built = buildBattleFromScenario(
    scenario,
    squad,
    registry,
    c.worldPower,
    rng,
    exp.battleIndex,
  )
  c.battle = built.battle
  startBattle(c.battle)
  c.phase = 'battle'
  return { ok: true, excluded: built.excludedCharacterIds }
}

export interface StartExpeditionParams {
  modeId: string
  characterIds: string[]
  registry: ContentRegistry
  rng: Rng
  seed: number
}

/** Старт экспедиции (§12.1): freeze состава, сетап первого боя. */
export function startExpedition(
  c: CampaignState,
  p: StartExpeditionParams,
): { ok: boolean; excluded: string[]; reason?: string } {
  const mode = p.registry.expeditions.get(p.modeId)
  if (!mode) return { ok: false, excluded: [], reason: 'нет режима' }
  if (p.characterIds.length < mode.partyMin)
    return { ok: false, excluded: [], reason: `нужно ≥${mode.partyMin} бойцов` }

  const ids = p.characterIds.slice(0, mode.partyMax)
  const battleCount =
    mode.kind === 'static' && mode.scenarioChain
      ? mode.scenarioChain.length
      : new SeededRng(p.seed).int(mode.battleCountRange[0], mode.battleCountRange[1])

  c.expedition = {
    scenarioChainId: p.modeId,
    generationSeed: p.seed,
    partySize: ids.length,
    squadSnapshot: ids.map((id) => ({ characterId: id, metaStatus: 'available' as const })),
    battleIndex: 0,
    battleCount,
    shopLocked: true,
    interBattleReviveAllDowned: mode.interBattleReviveAllDowned,
  }

  return setupCurrentBattle(c, p.registry, p.rng)
}

/** RETRY_CURRENT_BATTLE (§6.8, §15): полное восстановление снимка попытки. */
export function retryCurrentBattle(
  c: CampaignState,
  registry: ContentRegistry,
  rng: Rng,
): boolean {
  const snap = c.battleAttemptSnapshot
  if (!snap) return false
  c.gold = snap.gold
  c.worldPower = snap.worldPower
  c.characters = deepClone(snap.characters)
  c.chest = deepClone(snap.chest)
  c.battle = null
  return setupCurrentBattle(c, registry, rng).ok
}

/** ABANDON_BATTLE (§6.8): откат к снимку и выход в хаб, экспедиция прервана. */
export function abandonBattle(c: CampaignState): void {
  const snap = c.battleAttemptSnapshot
  if (snap) {
    c.gold = snap.gold
    c.worldPower = snap.worldPower
    c.characters = deepClone(snap.characters)
    c.chest = deepClone(snap.chest)
  }
  c.battle = null
  c.expedition = null
  c.battleAttemptSnapshot = null
  c.phase = 'hub'
}

/** Помечает downed-участников после боя в squadSnapshot (§12.3). */
export function markDownedAfterBattle(c: CampaignState): void {
  const exp = c.expedition
  if (!exp || !c.battle) return
  for (const m of exp.squadSnapshot) {
    const unit = c.battle.units.find((u) => u.characterId === m.characterId)
    if (unit && unit.hp <= 0) m.metaStatus = 'downed'
  }
}

/** Есть ли следующий бой в цепочке. */
export function hasNextBattle(c: CampaignState): boolean {
  const exp = c.expedition
  return !!exp && exp.battleIndex + 1 < exp.battleCount
}

/** Переход к экрану между боями (§12.3). */
export function toInterBattle(c: CampaignState): void {
  markDownedAfterBattle(c)
  c.battle = null
  c.phase = 'inter_battle'
}

/** INTER_BATTLE_REVIVE_ALL (§12.3), если сценарий разрешает. */
export function interBattleReviveAll(c: CampaignState): boolean {
  const exp = c.expedition
  if (!exp || !exp.interBattleReviveAllDowned) return false
  for (const m of exp.squadSnapshot) m.metaStatus = 'available'
  return true
}

/** Следующий бой экспедиции. */
export function advanceToNextBattle(
  c: CampaignState,
  registry: ContentRegistry,
  rng: Rng,
): { ok: boolean; excluded: string[]; reason?: string } {
  const exp = c.expedition
  if (!exp) return { ok: false, excluded: [], reason: 'нет экспедиции' }
  exp.battleIndex += 1
  return setupCurrentBattle(c, registry, rng)
}

/** FINISH_EXPEDITION (§12.3): возврат в хаб, downed → available. */
export function finishExpedition(c: CampaignState): void {
  c.expedition = null
  c.battle = null
  c.battleAttemptSnapshot = null
  c.phase = 'hub'
}
