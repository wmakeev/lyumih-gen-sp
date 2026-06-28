/**
 * Финализация боя (§16.6–16.7): синк прогресса носителей, броски смерти и
 * победы, награды (золото, дроп, codex, scenarioIndex).
 *
 * Порядок §16.7 при победе:
 *   1. L надетых предметов (weapon→armor→accessory).
 *   2. unitLevel героя (с lucky retry).
 *   3. Lm каждого filled mod slot всех носителей.
 *   4. Золото, дроп, codex, scenarioIndex.
 * Плюс §16.6: death roll unitLevel для downed союзников; worldPower += kills.
 */

import type { Rng } from '../rng'
import type { GameConfig } from '../config'
import type { CampaignState, PendingHubNotice } from '../types/campaign'
import type { Character } from '../types/character'
import type { ContentRegistry } from '../types/content'
import type { BattleState } from '../types/battle'
import type {
  CardInstance,
  ItemInstance,
  ModSlotState,
  PassiveInstance,
} from '../types/memento'
import {
  rollLevelUpWithLuck,
} from '../memento/levels'
import {
  rollEquippedItemLevel,
  rollUnitLevel,
  rollFilledModSlots,
} from '../memento/victory'
import { syncModSlotsForLevel } from '../memento/slots'
import { createCardInstance, createPassiveInstance } from './instances'
import { luckyFlags, offerCountFor, aggregateSquadMeta } from './specs'

function charById(c: CampaignState, id: string): Character | undefined {
  return c.characters.find((ch) => ch.id === id)
}

function equippedOf(ch: Character): {
  weapon?: ItemInstance
  armor?: ItemInstance
  accessory?: ItemInstance
} {
  const find = (id: string | null) => (id ? ch.items.find((i) => i.id === id) : undefined)
  return {
    weapon: find(ch.equipment.weapon),
    armor: find(ch.equipment.armor),
    accessory: find(ch.equipment.accessory),
  }
}

function syncCardSlots(
  inst: CardInstance | PassiveInstance,
  tags: string[],
  pool: ContentRegistry['cardItemMods'],
  offerCount: 3 | 4,
  config: GameConfig,
  rng: Rng,
): void {
  syncModSlotsForLevel(inst.modSlots, inst.global_level, {
    carrierTags: tags,
    pool: [...pool.values()],
    milestones: config.modSlotMilestones,
    offerCount,
    rng,
  })
}

function syncItemSlots(
  inst: ItemInstance,
  tags: string[],
  pool: ContentRegistry['cardItemMods'],
  offerCount: 3 | 4,
  config: GameConfig,
  rng: Rng,
): void {
  syncModSlotsForLevel(inst.modSlots, inst.itemLevel, {
    carrierTags: tags,
    pool: [...pool.values()],
    milestones: config.modSlotMilestones,
    offerCount,
    rng,
  })
}

/** Шаг 0: переносит живой прогресс из боя обратно в инстансы носителей. */
function syncBattleProgress(
  campaign: CampaignState,
  battle: BattleState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): void {
  for (const unit of battle.units) {
    if (unit.side !== 'player' || !unit.characterId) continue
    const ch = charById(campaign, unit.characterId)
    if (!ch) continue
    const oc = offerCountFor(ch, registry)

    for (const bc of unit.cards) {
      if (bc.isBasic) {
        // weapon: прогресс strike → itemLevel оружия (§16.5)
        if (bc.weaponInstanceId) {
          const w = ch.items.find((i) => i.id === bc.weaponInstanceId)
          if (w) {
            if (bc.level > w.itemLevel) w.itemLevel = bc.level
            const tpl = registry.items.get(w.templateId)
            syncItemSlots(w, tpl?.tags ?? ['weapon'], registry.cardItemMods, oc, config, rng)
          }
        }
        continue
      }
      const inst = ch.cards.find((c) => c.id === bc.instanceId)
      if (!inst) continue
      if (bc.level > inst.global_level) inst.global_level = bc.level
      inst.uses_count += bc.uses
      const tpl = registry.cards.get(inst.templateId)
      syncCardSlots(inst, tpl?.tags ?? ['skill'], registry.cardItemMods, oc, config, rng)
    }

    // armor/accessory: L за каждый полученный удар (§16.5)
    const eq = equippedOf(ch)
    const flags = luckyFlags(ch, registry)
    for (const item of [eq.armor, eq.accessory]) {
      if (!item) continue
      for (let h = 0; h < unit.hitsTaken; h++) {
        if (rollLevelUpWithLuck(item.itemLevel, rng, { lucky: flags.item })) item.itemLevel += 1
      }
      const tpl = registry.items.get(item.templateId)
      syncItemSlots(item, tpl?.tags ?? ['armor'], registry.cardItemMods, oc, config, rng)
    }
  }
}

/** §16.6: death roll unitLevel для downed союзников (победа И поражение). */
function applyDeathRolls(campaign: CampaignState, battle: BattleState, rng: Rng): number {
  let count = 0
  for (const unit of battle.units) {
    if (unit.side !== 'player' || unit.hp > 0 || !unit.characterId) continue
    const ch = charById(campaign, unit.characterId)
    if (!ch) continue
    ch.unitLevel = rollUnitLevel(ch.unitLevel, rng)
    count++
  }
  return count
}

/** §16.7 шаги 1-3: броски наград победы для каждого участника отряда. */
function applyVictoryRolls(
  campaign: CampaignState,
  battle: BattleState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): void {
  for (const unit of battle.units) {
    if (unit.side !== 'player' || !unit.characterId) continue
    const ch = charById(campaign, unit.characterId)
    if (!ch) continue
    const flags = luckyFlags(ch, registry)
    const oc = offerCountFor(ch, registry)
    const eq = equippedOf(ch)

    // 1. L надетых предметов: weapon → armor → accessory
    for (const [item, tagFallback] of [
      [eq.weapon, 'weapon'],
      [eq.armor, 'armor'],
      [eq.accessory, 'accessory'],
    ] as const) {
      if (!item) continue
      rollEquippedItemLevel(item, rng, { lucky: flags.item })
      const tpl = registry.items.get(item.templateId)
      syncItemSlots(item, tpl?.tags ?? [tagFallback], registry.cardItemMods, oc, config, rng)
    }

    // 2. unitLevel героя (lucky retry §16.7)
    ch.unitLevel = rollUnitLevel(ch.unitLevel, rng, { lucky: flags.unit })

    // 3. Lm каждого filled mod slot всех носителей (карты, предметы, пассивы)
    const allSlots: ModSlotState[][] = [
      ...ch.cards.map((c) => c.modSlots),
      ...ch.items.map((i) => i.modSlots),
      ...ch.passives.map((p) => p.modSlots),
    ]
    for (const slots of allSlots) rollFilledModSlots(slots, rng)
  }
}

/** §16.7 шаг 4: золото, дроп, codex, scenarioIndex. */
function applyRewards(
  campaign: CampaignState,
  battle: BattleState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
  goldReward: number,
): PendingHubNotice | null {
  const squad = battle.units
    .filter((u) => u.side === 'player' && u.characterId)
    .map((u) => charById(campaign, u.characterId!))
    .filter((c): c is Character => !!c)
  const meta = aggregateSquadMeta(squad, registry)

  // золото
  campaign.gold += Math.round(goldReward * (1 + meta.goldBonus))

  // дроп умения/пассива в сундук (независимые roll, §9.3)
  const cardChance = Math.min(1, config.drop.cardChance + meta.dropSkillBonus)
  const passiveChance = Math.min(1, config.drop.passiveChance + meta.dropPassiveBonus)
  let droppedCard = false
  let droppedPassive = false
  if (rng.chance(cardChance)) {
    const pool = [...registry.cards.values()].filter(
      (c) => c.id !== 'strike' && c.enabled !== false,
    )
    if (pool.length > 0) {
      campaign.chest.unboundCards.push(createCardInstance(rng.pick(pool).id))
      droppedCard = true
    }
  }
  if (rng.chance(passiveChance)) {
    const pool = [...registry.passives.values()].filter((p) => !p.isEnemy)
    if (pool.length > 0) {
      campaign.chest.unboundPassives.push(createPassiveInstance(rng.pick(pool).id))
      droppedPassive = true
    }
  }

  if (droppedCard && droppedPassive)
    return { kind: 'dual_drop', text: 'Двойной дроп: умение и пассив попали в сундук!' }
  if (droppedCard) return { kind: 'drop', text: 'Новое умение в сундуке!' }
  if (droppedPassive) return { kind: 'drop', text: 'Новый пассив в сундуке!' }
  return null
}

export interface FinalizeResult {
  notice: PendingHubNotice | null
  deaths: number
}

/** Главная точка: завершение боя по исходу (§16.6–16.7). */
export function finalizeBattle(
  campaign: CampaignState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
  goldReward: number,
): FinalizeResult {
  const battle = campaign.battle
  if (!battle) return { notice: null, deaths: 0 }

  // worldPower += убийства врагов (§6.9 / §16.6)
  campaign.worldPower += battle.enemyKills

  // 0. синк живого прогресса боя
  syncBattleProgress(campaign, battle, registry, config, rng)

  // death rolls (всегда)
  const deaths = applyDeathRolls(campaign, battle, rng)

  let notice: PendingHubNotice | null = null
  if (battle.phase === 'victory') {
    applyVictoryRolls(campaign, battle, registry, config, rng)
    notice = applyRewards(campaign, battle, registry, config, rng, goldReward)
  }

  return { notice, deaths }
}
