/**
 * Тонкие чистые селекторы чтения боевого состояния (§6).
 *
 * Дают UI маленький контракт чтения вместо прямого доступа к полной форме
 * `BattleUnit`/`BattleField`. Без мутаций, без импортов UI/React.
 */

import type { BattleState, BattleUnit } from '../types/battle'
import { isAlive, isDowned } from './queue'

/** Юнит, стоящий на клетке (x,y) — живой или лежащий (§6). */
export function unitAt(battle: BattleState, x: number, y: number): BattleUnit | undefined {
  return battle.units.find((u) => u.x === x && u.y === y && (isAlive(u) || isDowned(u)))
}

/** Процент здоровья юнита [0..100], округлённый (для полосы HP). */
export function unitHpPct(unit: BattleUnit): number {
  return unit.maxHp > 0 ? Math.round((unit.hp / unit.maxHp) * 100) : 0
}

/** Размеры боевого поля. */
export function fieldSize(battle: BattleState): { width: number; height: number } {
  return { width: battle.field.width, height: battle.field.height }
}
