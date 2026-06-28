/**
 * Боссовые спец-механики (§13.4) и элементальные теги урона (§13.3).
 *
 * Чистые помощники поверх BattleUnit.bossMechanics — без побочных эффектов и без
 * зависимости от движка (только типы), чтобы не плодить циклы импортов. Сам
 * движок (engine.ts) вызывает их в точках входа: applyDamage / healUnit /
 * onTurnStart / applyDefensiveProcs / очередь хода.
 */

import type { BattleState, BattleUnit } from '../types/battle'

/** Идентификаторы механик боссов (значения поля EnemyArchetype.bossMechanics). */
export type BossMechanic =
  | 'reflect'
  | 'enrage_below_half'
  | 'anti_heal'
  | 'spell_shield'
  | 'stealth'
  | 'evasion'
  | 'first_strike'
  | 'self_regen'
  | 'lifesteal'
  | 'damage_cap'
  | 'summon_minions'

/** Числовые параметры механик в одном месте (баланс §13.4). */
export const BOSS = {
  /** reflect: доля полученного урона, возвращаемая атакующему (%). */
  reflectPct: 30,
  /** enrage_below_half: множитель исходящего урона при HP < 50%. */
  enrageMult: 1.5,
  /** anti_heal: множитель лечения противников живого босса. */
  antiHealFactor: 0.3,
  /** spell_shield: множитель входящего магического (немеханического) урона. */
  spellShieldFactor: 0.5,
  /** stealth: вклад в шанс уклонения (%). */
  stealthDodgePct: 30,
  /** evasion: вклад в шанс уклонения (%). */
  evasionDodgePct: 25,
  /** потолок суммарного шанса уклонения (доля). */
  maxDodge: 0.9,
  /** first_strike: бонус к инициативе для очереди хода (ходит первым). */
  firstStrikeInitiative: 1000,
  /** self_regen: восстановление за ход (% от maxHp). */
  selfRegenPct: 8,
  /** lifesteal: вампиризм от нанесённого урона (%). */
  lifestealPct: 35,
  /** damage_cap: максимум урона за один удар (% от maxHp). */
  damageCapPct: 25,
  /** summon_minions: сколько миньонов и при каком пороге HP (доля). */
  minionCount: 2,
  summonHpThreshold: 0.5,
  /** миньон: доля статов/HP от босса. */
  minionStatFactor: 0.4,
  minionHpFactor: 0.25,
} as const

/** Стихийные теги урона (ключи affinities рас §13.3). */
const ELEMENT_TAGS: ReadonlySet<string> = new Set([
  'physical',
  'fire',
  'ice',
  'poison',
  'holy',
  'shadow',
  'lightning',
])

export function hasMechanic(u: BattleUnit | undefined, m: BossMechanic): boolean {
  return !!u?.bossMechanics?.includes(m)
}

/**
 * Стихийный тег умения для резистов: первый тег карты из ELEMENT_TAGS.
 * tags[0] — это вид (melee/aoe/skill), стихия лежит отдельным тегом, поэтому
 * ищем по множеству, а не берём первый.
 */
export function elementTag(tags: readonly string[]): string {
  for (const t of tags) if (ELEMENT_TAGS.has(t)) return t
  return 'physical'
}

/** Магический урон = любой стихийный, кроме physical (для spell_shield). */
export function isMagicTag(tag: string | undefined): boolean {
  return tag !== undefined && tag !== 'physical' && ELEMENT_TAGS.has(tag)
}

/** Суммарный шанс уклонения (stealth + evasion), доля 0..maxDodge. */
export function dodgeChance(u: BattleUnit): number {
  let pct = 0
  if (hasMechanic(u, 'stealth')) pct += BOSS.stealthDodgePct
  if (hasMechanic(u, 'evasion')) pct += BOSS.evasionDodgePct
  if (pct === 0) return 0
  return Math.min(BOSS.maxDodge, pct / 100)
}

/** Бонус инициативы для очереди (first_strike — ходит раньше прочих). */
export function firstStrikeBonus(u: BattleUnit): number {
  return hasMechanic(u, 'first_strike') ? BOSS.firstStrikeInitiative : 0
}

/** Есть ли живой босс-противник цели с anti_heal (лечение цели ослаблено). */
export function antiHealActiveAgainst(state: BattleState, target: BattleUnit): boolean {
  return state.units.some(
    (u) => u.hp > 0 && u.side !== target.side && hasMechanic(u, 'anti_heal'),
  )
}
