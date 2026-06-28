/**
 * Расчёт величины умений/атак, крита и защиты (§6.6) с применением модов
 * носителя (§16.12). Балансовая модель — линейная (см. docs/balance.md, §0).
 */

import type { Rng } from '../rng'
import { resolvePercentValue } from '../memento/percent'
import {
  applyDamageMult,
  applyHealMult,
  collectModEffects,
  rollProcExtraHits,
  type ModEffects,
  type ResolvedMod,
} from '../memento/mods'
import { DAMAGING_KINDS, HEALING_KINDS, type CardTemplate } from '../types/cards'
import type { BattleUnit } from '../types/battle'
import { effectiveStat } from './queue'
import { BOSS, hasMechanic } from './boss'

const CRIT_MULTIPLIER = 1.5

/** Стат-бонус к величине умения (§6.6). Линейная модель: прямой вклад стата
 * (с учётом статус-бафов/дебафов носителя). */
export function statBonus(caster: BattleUnit, card: CardTemplate): number {
  return Math.round(effectiveStat(caster, card.statSource))
}

/**
 * Базовая величина умения до модов (§6.6):
 * amount = skillFlat + resolvePercentValue(level, token) + statBonus
 * @param level L носителя НА МОМЕНТ ЗАМАХА (+ cardLevelBonus от экипировки)
 */
export function baseCardAmount(
  card: CardTemplate,
  level: number,
  caster: BattleUnit,
): number {
  const pct = resolvePercentValue(Math.max(0, level), card.scaleToken) ?? 0
  return card.skillFlat + pct + statBonus(caster, card)
}

export interface ResolvedAmount {
  /** Итоговая величина (урон или лечение), >= 0. */
  amount: number
  isHeal: boolean
  isCrit: boolean
  /** Число доп. ударов от proc_extra_hit (§16.12). */
  extraHits: number
  /** Собранные эффекты модов носителя (для lifesteal/self_heal и т.д.). */
  effects: ModEffects
}

/**
 * Полный расчёт величины действия с модами носителя, критом и (для урона)
 * защитой цели. Порядок §16.12: база → моды носителя → проки.
 */
export function resolveCardAmount(
  card: CardTemplate,
  level: number,
  caster: BattleUnit,
  target: BattleUnit | null,
  carrierMods: readonly ResolvedMod[],
  rng: Rng,
): ResolvedAmount {
  const effects = collectModEffects(carrierMods)
  const base = baseCardAmount(card, level, caster)
  const isHeal = HEALING_KINDS.has(card.kind) && !DAMAGING_KINDS.has(card.kind)

  if (isHeal) {
    return {
      amount: applyHealMult(base, effects),
      isHeal: true,
      isCrit: false,
      extraHits: 0,
      effects,
    }
  }

  // Урон: мод-мультипликатор → enrage → крит → защита цели
  let amount = applyDamageMult(base, effects)

  // enrage_below_half: исходящий урон усилен при HP < 50% (§13.4).
  if (hasMechanic(caster, 'enrage_below_half') && caster.hp * 2 < caster.maxHp) {
    amount = Math.round(amount * BOSS.enrageMult)
  }

  const critChance = Math.max(
    0,
    effectiveStat(caster, 'critChance') + effects.critChanceAdd,
  )
  const isCrit = rng.chance(critChance / 100)
  if (isCrit) amount = Math.round(amount * CRIT_MULTIPLIER)

  if (target) {
    const def = effectiveStat(target, 'defense')
    amount = Math.max(1, amount - def)
  }

  const extraHits = rollProcExtraHits(effects, rng)

  return { amount: Math.max(0, amount), isHeal: false, isCrit, extraHits, effects }
}
