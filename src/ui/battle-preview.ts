/**
 * Превью исхода действия ДО коммита (этап B1 редизайна).
 *
 * Чисто презентационный «сухой прогон» — зеркалит сбор целей и расчёт величины
 * из боевого движка, переиспользуя ЭКСПОРТИРУЕМЫЕ чистые функции ядра без каких
 * либо мутаций состояния (инвариант плана: ядро не трогаем). Крит/проки
 * детерминируются фиксированным RNG: минимум урона показываем без крита,
 * крит-значение — отдельным числом, шанс крита — процентом.
 */

import type { Rng } from '../core/rng'
import { resolveCardAmount } from '../core/battle/damage'
import { collectModEffects, resolveCarrierMods } from '../core/memento/mods'
import { manhattan, hasLineOfSight } from '../core/battle/geometry'
import { isAlive, isDowned } from '../core/battle/queue'
import type { BattleContext } from '../core/battle/engine'
import type { BattleState, BattleUnit, BattleCard, Cell } from '../core/types/battle'

/** RNG с фиксированным исходом для детерминированного превью. */
class FixedRng implements Rng {
  constructor(private readonly critYes: boolean) {}
  nextFloat(): number { return 0 }
  d100(): number { return 1 }
  int(min: number): number { return min }
  chance(p: number): boolean { return this.critYes && p > 0 }
  pick<T>(arr: readonly T[]): T { return arr[0]! }
  shuffle<T>(arr: readonly T[]): T[] { return arr.slice() }
}

const NO_CRIT = new FixedRng(false)
const ALL_CRIT = new FixedRng(true)

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

const HEAL_KINDS = new Set(['heal', 'regen'])
const STATUS_KINDS = new Set(['buff', 'debuff', 'dot'])

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
  const tpl = ctx.cards.get(card.templateId)
  if (!tpl) return null

  const mods = resolveCarrierMods(card.modSlots, ctx.mods)
  const effects = collectModEffects(mods)
  const range = tpl.maxRange + effects.rangeAdd
  const level = card.level + card.damageLevelBonus

  if (manhattan(caster, aim) > range) return null
  if (range > 1 && !hasLineOfSight(battle.field, caster, aim)) return null

  const isAoe = tpl.kind === 'aoe'
  const isResurrect = tpl.kind === 'resurrect'
  const isHealKind = HEAL_KINDS.has(tpl.kind)
  const isStatus = STATUS_KINDS.has(tpl.kind)

  const primary = battle.units.find(
    (u) => u.x === aim.x && u.y === aim.y && (isAlive(u) || isDowned(u)),
  )

  // Сбор поражаемых юнитов — зеркало useCard.
  let affected: BattleUnit[] = []
  if (isAoe) {
    const radius = (tpl.aoeRadius ?? 1) + effects.aoeSizeAdd
    affected = battle.units.filter(
      (u) => isAlive(u) && u.side !== caster.side && manhattan(aim, u) <= radius,
    )
  } else if (isResurrect) {
    if (primary && primary.side === caster.side && isDowned(primary)) affected = [primary]
  } else if (isHealKind || tpl.kind === 'buff') {
    if (primary && primary.side === caster.side && isAlive(primary)) affected = [primary]
  } else {
    if (primary && primary.side !== caster.side && isAlive(primary)) affected = [primary]
  }

  const critChance = Math.max(0, (caster.stats.critChance ?? 0) + effects.critChanceAdd)

  // Зона: для AoE — все клетки в радиусе (даже пустые), иначе сама точка.
  const zone = new Set<string>()
  if (isAoe) {
    const radius = (tpl.aoeRadius ?? 1) + effects.aoeSizeAdd
    for (let y = 0; y < battle.field.height; y++) {
      for (let x = 0; x < battle.field.width; x++) {
        if (manhattan(aim, { x, y }) <= radius) zone.add(`${x},${y}`)
      }
    }
  } else {
    zone.add(`${aim.x},${aim.y}`)
  }

  const targets: TargetPreview[] = affected.map((tgt) => {
    if (isStatus) {
      return { unitId: tgt.id, x: tgt.x, y: tgt.y, isHeal: false, statusOnly: true, amount: 0, willKill: false }
    }
    const heal = isHealKind || isResurrect
    const floor = resolveCardAmount(tpl, level, caster, heal ? null : tgt, mods, NO_CRIT)
    let amount = floor.amount
    let critAmount: number | undefined
    if (!heal && critChance > 0) {
      const crit = resolveCardAmount(tpl, level, caster, tgt, mods, ALL_CRIT)
      critAmount = crit.amount
    }
    // Центр AoE — множитель центра.
    if (isAoe && manhattan(aim, tgt) === 0) {
      amount = Math.round(amount * effects.aoeCenterDamageMult)
      if (critAmount !== undefined) critAmount = Math.round(critAmount * effects.aoeCenterDamageMult)
    }
    return {
      unitId: tgt.id,
      x: tgt.x,
      y: tgt.y,
      isHeal: heal,
      statusOnly: false,
      amount,
      critAmount,
      willKill: !heal && amount >= tgt.hp,
    }
  })

  return { zone, targets, critChance }
}
