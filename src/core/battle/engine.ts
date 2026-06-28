/**
 * Боевой движок (§6): действия, урон/лечение, downed, очередь, исход.
 *
 * Функции мутируют переданный BattleState (store заменяет ссылку целиком).
 * Вся случайность — через ctx.rng (инжекция §16.2). Логика решений в ядре,
 * UI только диспатчит (инвариант §2).
 */

import type { Rng } from '../rng'
import { WORLD_POWER_PER_ENEMY_KILL } from '../config'
import {
  resolveCarrierMods,
  collectModEffects,
  type ResolvedMod,
} from '../memento/mods'
import { rollLevelUpWithLuck } from '../memento/levels'
import { resolvePercentValue } from '../memento/percent'
import type { CardTemplate } from '../types/cards'
import type { ModTemplate } from '../types/memento'
import type {
  BattleState,
  BattleUnit,
  BattleCard,
  Cell,
  BattleLogEntry,
} from '../types/battle'
import { manhattan, hasLineOfSight, reachableCells } from './geometry'
import {
  computeTurnOrder,
  isAlive,
  isDowned,
  unitById,
  activeUnit,
  aliveBySide,
} from './queue'
import { resolveCardAmount } from './damage'

export interface BattleContext {
  cards: ReadonlyMap<string, CardTemplate>
  mods: ReadonlyMap<string, ModTemplate>
  rng: Rng
  /** Резисты/уязвимости по расе и тегу урона (множитель). По умолчанию 1. */
  resist?: (raceId: string | undefined, damageTag: string | undefined) => number
}

function log(state: BattleState, kind: BattleLogEntry['kind'], text: string): void {
  state.log.push({ round: state.round, text, kind })
}

function occupiedCellKeys(state: BattleState, exceptId?: string): Set<string> {
  const set = new Set<string>()
  for (const u of state.units) {
    if (u.id === exceptId) continue
    if (isAlive(u)) set.add(`${u.x},${u.y}`)
  }
  return set
}

function unitAtAlive(state: BattleState, x: number, y: number): BattleUnit | undefined {
  return state.units.find((u) => isAlive(u) && u.x === x && u.y === y)
}

// --- Раунды и очередь ---

/** Начинает новый раунд: пересчёт очереди, сброс флагов хода. */
export function beginRound(state: BattleState): void {
  state.round += 1
  state.turnOrder = computeTurnOrder(state.units)
  state.activeIndex = 0
  for (const u of state.units) u.hasActedThisRound = false
  const first = activeUnit(state)
  if (first) onTurnStart(state, first)
}

/** Инициализирует бой к первому раунду. */
export function startBattle(state: BattleState): void {
  state.round = 0
  state.phase = 'ongoing'
  state.log = []
  beginRound(state)
}

/** Обработка начала хода юнита: тик статусов, декремент cooldown. */
export function onTurnStart(state: BattleState, unit: BattleUnit): void {
  // cooldown карт
  for (const c of unit.cards) {
    if (c.cooldownLeft > 0) c.cooldownLeft -= 1
  }
  // тик статусов (dot/regen)
  const survivors: typeof unit.statusEffects = []
  for (const st of unit.statusEffects) {
    if (st.tickAmount && isAlive(unit)) {
      if (st.tickAmount < 0) {
        applyDamage(state, unit, -st.tickAmount, st.damageTag, `${st.specId}`)
      } else {
        healUnit(state, unit, st.tickAmount, st.specId)
      }
    }
    st.remainingTurns -= 1
    if (st.remainingTurns > 0) survivors.push(st)
  }
  unit.statusEffects = survivors
}

/** Переход хода к следующему живому юниту; при исчерпании — новый раунд. */
export function endTurn(state: BattleState): void {
  const cur = activeUnit(state)
  if (cur) cur.hasActedThisRound = true
  if (checkBattleEnd(state)) return

  let next = state.activeIndex + 1
  while (next < state.turnOrder.length) {
    const u = unitById(state, state.turnOrder[next]!)
    if (u && isAlive(u)) {
      state.activeIndex = next
      onTurnStart(state, u)
      return
    }
    next++
  }
  // раунд закончен
  beginRound(state)
}

// --- Перемещение ---

export function legalMoves(state: BattleState, unitId: string): Cell[] {
  const u = unitById(state, unitId)
  if (!u || !isAlive(u)) return []
  const blocked = occupiedCellKeys(state, unitId)
  const reach = reachableCells(state.field, u, u.stats.speed, blocked)
  return [...reach.keys()].map((k) => {
    const [x, y] = k.split(',').map(Number)
    return { x: x!, y: y! }
  })
}

export function applyMove(state: BattleState, unitId: string, dest: Cell): boolean {
  const u = unitById(state, unitId)
  if (!u || !isAlive(u)) return false
  const blocked = occupiedCellKeys(state, unitId)
  const reach = reachableCells(state.field, u, u.stats.speed, blocked)
  if (!reach.has(`${dest.x},${dest.y}`)) return false
  u.x = dest.x
  u.y = dest.y
  log(state, 'move', `${u.displayName} перемещается на (${dest.x}, ${dest.y})`)
  return true
}

// --- Урон и лечение ---

/** Наносит урон юниту, обрабатывает downed/kill/worldPower и защитные проки. */
export function applyDamage(
  state: BattleState,
  target: BattleUnit,
  rawAmount: number,
  damageTag: string | undefined,
  sourceLabel: string,
): number {
  if (!isAlive(target)) return 0
  void damageTag // резисты по тегам/расам — расширение Этапа 3 (§13.3)
  const amount = Math.max(0, Math.round(rawAmount))
  target.hp = Math.max(0, target.hp - amount)
  if (amount > 0) target.hitsTaken += 1
  log(
    state,
    'attack',
    `${sourceLabel} наносит ${amount} урона по ${target.displayName} (HP ${target.hp}/${target.maxHp})`,
  )
  if (target.hp === 0) {
    log(state, 'death', `${target.displayName} повержен`)
    if (target.side === 'enemy') {
      state.enemyKills += WORLD_POWER_PER_ENEMY_KILL
    }
  }
  return amount
}

export function healUnit(
  state: BattleState,
  target: BattleUnit,
  amount: number,
  sourceLabel: string,
): number {
  // Лечение выше 0 поднимает downed (§6.7)
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + Math.max(0, Math.round(amount)))
  const healed = target.hp - before
  if (healed > 0) {
    const revived = before === 0 && target.hp > 0
    log(
      state,
      'heal',
      `${sourceLabel} восстанавливает ${healed} HP ${target.displayName}` +
        (revived ? ' (поднят из downed)' : ''),
    )
  }
  return healed
}

// --- Применение карт ---

function carrierModsOf(card: BattleCard, ctx: BattleContext): ResolvedMod[] {
  return resolveCarrierMods(card.modSlots, ctx.mods)
}

export interface UseCardResult {
  ok: boolean
  reason?: string
}

/** Цели в радиусе действия карты от кастера (с LoS для дальних). */
export function cardTargets(
  state: BattleState,
  caster: BattleUnit,
  card: BattleCard,
  ctx: BattleContext,
): BattleUnit[] {
  const tpl = ctx.cards.get(card.templateId)
  if (!tpl) return []
  const mods = collectModEffects(carrierModsOf(card, ctx))
  const range = tpl.maxRange + mods.rangeAdd
  const wantAllies = tpl.kind === 'heal' || tpl.kind === 'regen' || tpl.kind === 'buff'
  const wantDowned = tpl.kind === 'resurrect'
  return state.units.filter((u) => {
    if (manhattan(caster, u) > range) return false
    if (range > 1 && !hasLineOfSight(state.field, caster, u)) return false
    if (wantDowned) return u.side === caster.side && isDowned(u)
    if (!isAlive(u)) return false
    return wantAllies ? u.side === caster.side : u.side !== caster.side
  })
}

/**
 * Применяет карту кастера по цели (или клетке для AoE). Обрабатывает cooldown,
 * урон/лечение/статусы/AoE/lifesteal/resurrect, проки доп. ударов, и L-прогресс
 * носителя (§16.3). Возвращает результат.
 */
export function useCard(
  state: BattleState,
  casterId: string,
  cardInstanceId: string,
  target: { unitId?: string; cell?: Cell },
  ctx: BattleContext,
): UseCardResult {
  const caster = unitById(state, casterId)
  if (!caster || !isAlive(caster)) return { ok: false, reason: 'нет кастера' }
  const card = caster.cards.find((c) => c.instanceId === cardInstanceId)
  if (!card) return { ok: false, reason: 'нет карты' }
  if (card.cooldownLeft > 0) return { ok: false, reason: 'cooldown' }
  const tpl = ctx.cards.get(card.templateId)
  if (!tpl) return { ok: false, reason: 'нет шаблона' }

  const mods = carrierModsOf(card, ctx)
  const effects = collectModEffects(mods)
  const range = tpl.maxRange + effects.rangeAdd

  const levelForCalc = card.level + card.damageLevelBonus

  // Определяем основную цель
  let primary: BattleUnit | undefined
  if (target.unitId) primary = unitById(state, target.unitId)
  else if (target.cell) primary = unitAtAlive(state, target.cell.x, target.cell.y)

  const isAoe = tpl.kind === 'aoe'
  const isResurrect = tpl.kind === 'resurrect'
  const isHealKind = tpl.kind === 'heal' || tpl.kind === 'regen'
  const isBuff = tpl.kind === 'buff'
  const isDebuff = tpl.kind === 'debuff'
  const isDot = tpl.kind === 'dot'

  // Валидация дистанции по выбранной точке
  const aim: Cell | undefined = target.cell ?? (primary ? { x: primary.x, y: primary.y } : undefined)
  if (!aim) return { ok: false, reason: 'нет цели' }
  if (manhattan(caster, aim) > range) return { ok: false, reason: 'вне дальности' }
  if (range > 1 && !hasLineOfSight(state.field, caster, aim))
    return { ok: false, reason: 'нет линии видимости' }

  // Сбор целей
  let affected: BattleUnit[] = []
  if (isAoe) {
    const radius = (tpl.aoeRadius ?? 1) + effects.aoeSizeAdd
    affected = state.units.filter(
      (u) => isAlive(u) && u.side !== caster.side && manhattan(aim, u) <= radius,
    )
  } else if (isResurrect) {
    if (primary && primary.side === caster.side && isDowned(primary)) affected = [primary]
  } else if (isHealKind || isBuff) {
    if (primary && primary.side === caster.side && isAlive(primary)) affected = [primary]
  } else {
    if (primary && primary.side !== caster.side && isAlive(primary)) affected = [primary]
  }

  if (affected.length === 0 && !isResurrect)
    return { ok: false, reason: 'нет целей' }

  // Применение эффекта
  for (const tgt of affected) {
    if (isResurrect) {
      const amount = resolveCardAmount(tpl, levelForCalc, caster, null, mods, ctx.rng)
      tgt.hp = Math.min(tgt.maxHp, Math.max(1, amount.amount))
      log(state, 'heal', `${caster.displayName} воскрешает ${tgt.displayName}`)
      continue
    }
    const res = resolveCardAmount(tpl, levelForCalc, caster, tgt, mods, ctx.rng)
    if (res.isHeal || isHealKind) {
      healUnit(state, tgt, res.amount, caster.displayName)
    } else if (isBuff || isDot || isDebuff) {
      applyStatus(state, caster, tgt, tpl, levelForCalc)
      if (isDot && tpl.status?.tickAmount) {
        // первичный урон не наносим — только статус с тиком
      }
    } else {
      // урон + центр AoE + крит + лайфстил
      let dmg = res.amount
      if (isAoe && manhattan(aim, tgt) === 0) dmg = Math.round(dmg * effects.aoeCenterDamageMult)
      if (res.isCrit) log(state, 'crit', `Крит по ${tgt.displayName}!`)
      const dealt = applyDamage(state, tgt, dmg, tpl.tags[0], caster.displayName)
      // доп. удары (proc_extra_hit)
      for (let h = 0; h < res.extraHits && isAlive(tgt); h++) {
        const extra = resolveCardAmount(tpl, levelForCalc, caster, tgt, mods, ctx.rng)
        log(state, 'mod_proc', `Доп. удар по ${tgt.displayName}`)
        applyDamage(state, tgt, extra.amount, tpl.tags[0], caster.displayName)
      }
      // lifesteal
      if (effects.lifestealPct > 0 && dealt > 0) {
        healUnit(state, caster, (dealt * effects.lifestealPct) / 100, `${caster.displayName} (вампиризм)`)
      }
      // защитные проки цели (reflect / self_heal_on_damaged)
      applyDefensiveProcs(state, tgt, caster, dealt, ctx)
    }
  }

  // self_heal_on_use
  if (effects.selfHealOnUsePct > 0) {
    const base = resolveCardAmount(tpl, levelForCalc, caster, null, mods, ctx.rng)
    healUnit(state, caster, (base.amount * effects.selfHealOnUsePct) / 100, `${caster.displayName} (самолечение)`)
  }

  // cooldown и L-прогресс носителя (§16.3 / §7.4)
  card.cooldownLeft = card.cooldownTurns
  card.uses += 1
  if (!card.isBasic) {
    if (rollLevelUpWithLuck(card.level, ctx.rng, { lucky: caster.luckyCard })) card.level += 1
  }

  checkBattleEnd(state)
  return { ok: true }
}

function applyStatus(
  state: BattleState,
  caster: BattleUnit,
  target: BattleUnit,
  tpl: CardTemplate,
  level: number,
): void {
  const spec = tpl.status
  if (!spec) return
  let tick = spec.tickAmount
  if (tick !== undefined && spec.tickToken) {
    // масштабируем модуль тика по уровню умения, сохраняя знак
    const sign = Math.sign(tick)
    const scaled = resolvePercentValue(Math.max(0, level), spec.tickToken)
    if (scaled !== null) tick = sign * Math.abs(scaled)
  }
  target.statusEffects.push({
    id: `${spec.id}-${state.round}-${target.id}`,
    specId: spec.id,
    remainingTurns: spec.duration,
    statMods: spec.statMods,
    tickAmount: tick,
    damageTag: spec.damageTag,
    sourceUnitId: caster.id,
  })
  log(state, 'status', `${caster.displayName} накладывает ${spec.id} на ${target.displayName}`)
}

/** Защитные проки экипировки цели при получении урона (§16.12 п.4). */
function applyDefensiveProcs(
  state: BattleState,
  target: BattleUnit,
  attacker: BattleUnit,
  damageDealt: number,
  ctx: BattleContext,
): void {
  if (damageDealt <= 0 || !target.defensiveMods) return
  const eff = collectModEffects(resolveCarrierMods(target.defensiveMods, ctx.mods))
  if (eff.reflectOnHitPct > 0 && isAlive(attacker)) {
    const reflected = Math.round((damageDealt * eff.reflectOnHitPct) / 100)
    if (reflected > 0) {
      log(state, 'mod_proc', `${target.displayName} отражает ${reflected} урона`)
      applyDamage(state, attacker, reflected, undefined, `${target.displayName} (отражение)`)
    }
  }
  if (eff.selfHealOnDamagedPct > 0 && isAlive(target)) {
    healUnit(state, target, (damageDealt * eff.selfHealOnDamagedPct) / 100, `${target.displayName} (регенерация брони)`)
  }
}

// --- Базовая атака (strike/shot/magic_bolt) ---

export function basicAttack(
  state: BattleState,
  casterId: string,
  targetUnitId: string,
  ctx: BattleContext,
): UseCardResult {
  const caster = unitById(state, casterId)
  if (!caster || !isAlive(caster)) return { ok: false, reason: 'нет кастера' }
  const strike = caster.cards.find((c) => c.isBasic)
  if (!strike) return { ok: false, reason: 'нет базовой атаки' }
  const res = useCard(state, casterId, strike.instanceId, { unitId: targetUnitId }, ctx)
  // L оружия (§16.5): прогресс на оружие — растёт уровень strike-карты (level=itemLevel)
  if (res.ok && strike.weaponInstanceId) {
    if (rollLevelUpWithLuck(strike.level, ctx.rng, { lucky: caster.luckyItem })) strike.level += 1
  }
  return res
}

// --- Исход боя ---

/** Проверяет и фиксирует исход (§6.8). Возвращает true, если бой завершён. */
export function checkBattleEnd(state: BattleState): boolean {
  const playersAlive = aliveBySide(state, 'player').length
  const enemiesAlive = aliveBySide(state, 'enemy').length
  if (enemiesAlive === 0) {
    state.phase = 'victory'
    return true
  }
  if (playersAlive === 0) {
    state.phase = 'defeat'
    return true
  }
  return false
}
