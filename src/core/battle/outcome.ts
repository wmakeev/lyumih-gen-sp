/**
 * Единый источник боевого правила «что делает карта» (§6.5–6.6).
 *
 * `resolveCardOutcome` — ЧИСТАЯ функция без мутаций состояния: по кастеру, карте
 * и точке прицеливания возвращает описуемый план исхода (поражаемые клетки,
 * цели с их величинами, крит-ветку, достижимость, эффекты модов). Один и тот же
 * план потребляют три клиента:
 *  - движок (`engine.useCard`) — ПРИМЕНЯЕТ план к состоянию;
 *  - превью (`ui/battle-preview`) — рендерит зону/числа;
 *  - ИИ (`ai`) — читает достижимость и оценку урона.
 *
 * Раньше это правило было продублировано в трёх местах; теперь оно живёт здесь.
 * Точки применения мод-эффектов исхода (rangeAdd, aoeCenterDamageMult,
 * damageMult, критшанс) собраны внутри резолвера; величины lifesteal/self-heal
 * экспонируются через `effects`/`selfHealBaseAmount` для применения движком.
 *
 * Случайность инжектируется через `ctx.rng`. Для «сухого прогона» (превью/ИИ)
 * используются детерминированные RNG (`NO_CRIT`/`ALL_CRIT`), не потребляющие
 * боевой поток случайности.
 */

import type { Rng } from '../rng'
import {
  collectModEffects,
  resolveCarrierMods,
  type ModEffects,
  type ResolvedMod,
} from '../memento/mods'
import type { CardTemplate } from '../types/cards'
import type { ModTemplate } from '../types/memento'
import type { BattleState, BattleUnit, BattleCard, Cell } from '../types/battle'
import { manhattan, hasLineOfSight } from './geometry'
import { isAlive, isDowned, effectiveStat } from './queue'
import { resolveCardAmount } from './damage'

/** RNG с фиксированным исходом крита для детерминированного «сухого прогона». */
export class FixedRng implements Rng {
  constructor(private readonly critYes: boolean) {}
  nextFloat(): number {
    return 0
  }
  d100(): number {
    return 1
  }
  int(min: number): number {
    return min
  }
  chance(p: number): boolean {
    return this.critYes && p > 0
  }
  pick<T>(arr: readonly T[]): T {
    return arr[0]!
  }
  shuffle<T>(arr: readonly T[]): T[] {
    return arr.slice()
  }
}

/** Без крита и проков — «пол» величины (превью-минимум, ИИ-оценка). */
export const NO_CRIT = new FixedRng(false)
/** Все криты — «потолок» величины (превью крит-значение). */
export const ALL_CRIT = new FixedRng(true)

const HEAL_KINDS = new Set(['heal', 'regen'])
const STATUS_KINDS = new Set(['buff', 'debuff', 'dot'])

/** Контекст, необходимый резолверу (подмножество BattleContext). */
export interface OutcomeContext {
  cards: ReadonlyMap<string, CardTemplate>
  mods: ReadonlyMap<string, ModTemplate>
  rng: Rng
}

export type OutcomeTargetKind = 'damage' | 'heal' | 'resurrect' | 'status'

/** Один удар/лечение по цели (damage может содержать несколько — доп. удары). */
export interface OutcomeHit {
  amount: number
  isCrit: boolean
}

export interface OutcomeTarget {
  unitId: string
  x: number
  y: number
  /** Тип воздействия на цель. */
  kind: OutcomeTargetKind
  /** Величины по порядку применения: [основной, доп.удары…]. Пусто для status. */
  hits: OutcomeHit[]
}

export interface CardOutcome {
  /** Эффективная дальность (maxRange + rangeAdd). */
  range: number
  /** Точка прицеливания в пределах дальности (манхэттен ≤ range). */
  distanceOk: boolean
  /** Линия видимости до точки (для дальних, range>1). */
  losOk: boolean
  /** distanceOk && losOk. */
  inRange: boolean
  /** L носителя на момент замаха (card.level + damageLevelBonus). */
  level: number
  isAoe: boolean
  isResurrect: boolean
  /** heal|regen — для отображения как лечение. */
  isHeal: boolean
  /** buff|debuff|dot — только статус, без чисел. */
  isStatus: boolean
  /** Все поражаемые клетки: для AoE — вся зона в радиусе, иначе точка прицела. */
  zone: Set<string>
  /** Эффективный шанс крита, % (с учётом статусов и модов). */
  critChance: number
  /** Цели с их величинами. */
  targets: OutcomeTarget[]
  /** Эффекты модов носителя (lifesteal/self-heal/proc… — потребляет движок). */
  effects: ModEffects
  /** Разрешённые моды носителя (для доп. вычислений движка). */
  mods: ResolvedMod[]
  /** База величины действия для self_heal_on_use (0, если не нужен). */
  selfHealBaseAmount: number
}

function targetKindFor(kind: CardTemplate['kind'], isResurrect: boolean): OutcomeTargetKind {
  if (isResurrect) return 'resurrect'
  if (HEAL_KINDS.has(kind)) return 'heal'
  if (STATUS_KINDS.has(kind)) return 'status'
  return 'damage'
}

/**
 * Разрешает исход применения карты `card` кастером `caster` по точке `aim` без
 * мутаций состояния. Возвращает null, если шаблон не найден.
 *
 * ВНИМАНИЕ: для damage-целей потребляет `ctx.rng` (крит + проки доп. ударов) в
 * порядке применения. Для сухого прогона передавайте NO_CRIT/ALL_CRIT.
 */
export function resolveCardOutcome(
  state: BattleState,
  caster: BattleUnit,
  card: BattleCard,
  aim: Cell,
  ctx: OutcomeContext,
): CardOutcome | null {
  const tpl = ctx.cards.get(card.templateId)
  if (!tpl) return null

  const mods = resolveCarrierMods(card.modSlots, ctx.mods)
  const effects = collectModEffects(mods)
  const range = tpl.maxRange + effects.rangeAdd
  const level = card.level + card.damageLevelBonus

  const distanceOk = manhattan(caster, aim) <= range
  const losOk = range <= 1 || hasLineOfSight(state.field, caster, aim)
  const inRange = distanceOk && losOk

  const isAoe = tpl.kind === 'aoe'
  const isResurrect = tpl.kind === 'resurrect'
  const isHeal = HEAL_KINDS.has(tpl.kind)
  const isStatus = STATUS_KINDS.has(tpl.kind)

  const primary = state.units.find(
    (u) => u.x === aim.x && u.y === aim.y && (isAlive(u) || isDowned(u)),
  )

  // Сбор поражаемых юнитов — ЕДИНСТВЕННАЯ копия правила выбора целей.
  const radius = (tpl.aoeRadius ?? 1) + effects.aoeSizeAdd
  let affected: BattleUnit[] = []
  if (isAoe) {
    affected = state.units.filter(
      (u) => isAlive(u) && u.side !== caster.side && manhattan(aim, u) <= radius,
    )
  } else if (isResurrect) {
    if (primary && primary.side === caster.side && isDowned(primary)) affected = [primary]
  } else if (isHeal || tpl.kind === 'buff') {
    if (primary && primary.side === caster.side && isAlive(primary)) affected = [primary]
  } else {
    if (primary && primary.side !== caster.side && isAlive(primary)) affected = [primary]
  }

  const critChance = Math.max(0, effectiveStat(caster, 'critChance') + effects.critChanceAdd)

  // Зона: для AoE — все клетки в радиусе (даже пустые), иначе сама точка.
  const zone = new Set<string>()
  if (isAoe) {
    for (let y = 0; y < state.field.height; y++) {
      for (let x = 0; x < state.field.width; x++) {
        if (manhattan(aim, { x, y }) <= radius) zone.add(`${x},${y}`)
      }
    }
  } else {
    zone.add(`${aim.x},${aim.y}`)
  }

  const targets: OutcomeTarget[] = affected.map((tgt) => {
    const kind = targetKindFor(tpl.kind, isResurrect)
    if (kind === 'status') {
      return { unitId: tgt.id, x: tgt.x, y: tgt.y, kind, hits: [] }
    }
    if (kind === 'heal' || kind === 'resurrect') {
      // Лечение/воскрешение: величина считается без цели (без защиты).
      const res = resolveCardAmount(tpl, level, caster, null, mods, ctx.rng)
      return {
        unitId: tgt.id,
        x: tgt.x,
        y: tgt.y,
        kind,
        hits: [{ amount: res.amount, isCrit: res.isCrit }],
      }
    }
    // Урон: основной удар (+ центр AoE) и доп. удары (proc_extra_hit).
    const primaryRes = resolveCardAmount(tpl, level, caster, tgt, mods, ctx.rng)
    let amount = primaryRes.amount
    if (isAoe && manhattan(aim, tgt) === 0) {
      amount = Math.round(amount * effects.aoeCenterDamageMult)
    }
    const hits: OutcomeHit[] = [{ amount, isCrit: primaryRes.isCrit }]
    for (let h = 0; h < primaryRes.extraHits; h++) {
      const extra = resolveCardAmount(tpl, level, caster, tgt, mods, ctx.rng)
      hits.push({ amount: extra.amount, isCrit: extra.isCrit })
    }
    return { unitId: tgt.id, x: tgt.x, y: tgt.y, kind, hits }
  })

  // База для self_heal_on_use (мод-эффект исхода): считаем один раз в конце,
  // в том же порядке потребления rng, что и раньше в движке.
  let selfHealBaseAmount = 0
  if (effects.selfHealOnUsePct > 0) {
    selfHealBaseAmount = resolveCardAmount(tpl, level, caster, null, mods, ctx.rng).amount
  }

  return {
    range,
    distanceOk,
    losOk,
    inRange,
    level,
    isAoe,
    isResurrect,
    isHeal,
    isStatus,
    zone,
    critChance,
    targets,
    effects,
    mods,
    selfHealBaseAmount,
  }
}
