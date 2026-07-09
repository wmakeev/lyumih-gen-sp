/**
 * Превью исхода действия ДО коммита (этап B1 редизайна).
 *
 * Чисто презентационный «сухой прогон». Не дублирует боевое правило: сбор целей,
 * дальность, величина и зона AoE берутся из ЕДИНОГО резолвера ядра
 * `resolveCardOutcome`. Крит/проки детерминируются фиксированным RNG (NO_CRIT/
 * ALL_CRIT ядра): минимум урона — без крита, крит-значение — отдельным числом,
 * шанс крита — процентом. Мутаций состояния нет (инвариант плана).
 */

import { resolveCardOutcome, NO_CRIT, ALL_CRIT } from '../core/battle/outcome'
import type { BattleContext } from '../core/battle/engine'
import type { BattleState, BattleUnit, BattleCard, Cell } from '../core/types/battle'

export interface TargetPreview {
  unitId: string
  x: number
  y: number
  /** Лечение (true) или урон (false). */
  isHeal: boolean
  /** Только статус (buff/debuff/dot) — числа нет. */
  statusOnly: boolean
  /** Минимальная величина (без крита). */
  amount: number
  /** Величина при крите (если шанс крита > 0). */
  critAmount?: number
  /** Действие добьёт цель (по минимуму урона). */
  willKill: boolean
}

export interface ActionPreview {
  /** Все поражаемые клетки (для AoE — вся зона), ключи "x,y". */
  zone: Set<string>
  targets: TargetPreview[]
  /** Эффективный шанс крита, %. */
  critChance: number
}

/**
 * Сухой расчёт исхода применения карты `card` кастером `caster` по точке `aim`.
 * Возвращает поражаемые клетки и предполагаемые числа. Без мутаций.
 */
export function previewAction(
  battle: BattleState,
  caster: BattleUnit,
  card: BattleCard,
  aim: Cell,
  ctx: BattleContext,
): ActionPreview | null {
  // «Пол» величины — без крита. Фиксированный RNG не трогает боевой поток.
  const floor = resolveCardOutcome(battle, caster, card, aim, { ...ctx, rng: NO_CRIT })
  if (!floor) return null
  if (!floor.inRange) return null

  const needCrit = floor.critChance > 0
  // «Потолок» — все криты. Совпадает по составу/порядку целей с floor.
  const crit = needCrit
    ? resolveCardOutcome(battle, caster, card, aim, { ...ctx, rng: ALL_CRIT })
    : null

  const targets: TargetPreview[] = floor.targets.map((t, i) => {
    const statusOnly = t.kind === 'status'
    const isHeal = t.kind === 'heal' || t.kind === 'resurrect'
    if (statusOnly) {
      return { unitId: t.unitId, x: t.x, y: t.y, isHeal: false, statusOnly: true, amount: 0, willKill: false }
    }
    const amount = t.hits[0]?.amount ?? 0
    let critAmount: number | undefined
    if (!isHeal && needCrit) {
      critAmount = crit?.targets[i]?.hits[0]?.amount
    }
    const tgt = battle.units.find((u) => u.id === t.unitId)
    return {
      unitId: t.unitId,
      x: t.x,
      y: t.y,
      isHeal,
      statusOnly: false,
      amount,
      critAmount,
      willKill: !isHeal && tgt !== undefined && amount >= tgt.hp,
    }
  })

  return { zone: floor.zone, targets, critChance: floor.critChance }
}
