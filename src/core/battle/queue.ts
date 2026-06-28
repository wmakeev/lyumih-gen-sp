/**
 * Очередь хода (§6.3): каждый раунд порядок пересчитывается по initiative
 * (убывание). Downed-юниты (hp=0) исключаются. Тай-брейк — по id (детерминизм).
 */

import type { BattleState, BattleUnit } from '../types/battle'
import type { StatBlock } from '../types/stats'
import { firstStrikeBonus } from './boss'

export function isDowned(u: BattleUnit): boolean {
  return u.hp <= 0
}

export function isAlive(u: BattleUnit): boolean {
  return u.hp > 0
}

/**
 * Эффективное значение стата юнита = база + суммарные statMods активных
 * статус-эффектов (бафы/дебафы карт). Единая точка для боевой математики и
 * очереди — иначе бафы работают только на инициативу.
 */
export function effectiveStat(u: BattleUnit, stat: keyof StatBlock): number {
  let v = u.stats[stat] ?? 0
  for (const st of u.statusEffects) {
    v += st.statMods?.[stat] ?? 0
  }
  return v
}

/** Текущая (effective) инициатива юнита с учётом статусов. */
export function unitInitiative(u: BattleUnit): number {
  return effectiveStat(u, 'initiative')
}

/** Пересчёт очереди раунда: живые, по убыванию инициативы, тай-брейк по id. */
export function computeTurnOrder(units: readonly BattleUnit[]): string[] {
  return units
    .filter(isAlive)
    .slice()
    .sort((a, b) => {
      // first_strike-боссы получают приоритет очереди (§13.4).
      const di =
        unitInitiative(b) + firstStrikeBonus(b) - (unitInitiative(a) + firstStrikeBonus(a))
      if (di !== 0) return di
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    .map((u) => u.id)
}

/**
 * Бейдж очереди для клетки (§6.3): позиция юнита в текущем раунде (1..N) или
 * R+позиция для следующего раунда, если уже ходил. Возвращает строку.
 */
export function queueBadge(state: BattleState, unitId: string): string | null {
  const idx = state.turnOrder.indexOf(unitId)
  if (idx < 0) return null
  return String(idx + 1)
}

export function unitById(state: BattleState, id: string): BattleUnit | undefined {
  return state.units.find((u) => u.id === id)
}

export function activeUnit(state: BattleState): BattleUnit | undefined {
  const id = state.turnOrder[state.activeIndex]
  return id ? unitById(state, id) : undefined
}

export function aliveBySide(state: BattleState, side: 'player' | 'enemy'): BattleUnit[] {
  return state.units.filter((u) => u.side === side && isAlive(u))
}
