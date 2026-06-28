/**
 * Движок модов (§16.10–16.12): масштаб по lm, агрегация эффектов, проки.
 *
 * §16.10: effective = base × (1 + lm/100) — percent-ops дают ×2 при lm=100.
 * Поле scaleMode определяет, КАК эффект применяется (множитель урона/лечения
 * против flat-прибавки), но величина всегда масштабируется на (1 + lm/100).
 */

import type { Rng } from '../rng'
import type { ModOp, ModSlotState, ModTemplate } from '../types/memento'

/** Filled-мод с разрешённым шаблоном и его lm. */
export interface ResolvedMod {
  template: ModTemplate
  lm: number
}

/** Масштаб величины мода по lm (§16.10). */
export function scaleByLm(base: number, lm: number): number {
  return base * (1 + lm / 100)
}

/** Агрегированные боевые эффекты набора модов носителя. */
export interface ModEffects {
  /** Мультипликатор урона (1 = без изменений). */
  damageMult: number
  /** Мультипликатор лечения. */
  healMult: number
  /** Прибавка дальности (клетки, округлённая). */
  rangeAdd: number
  /** Прибавка к cooldown (ходы). */
  cooldownAdd: number
  /** Прибавка размера AoE. */
  aoeSizeAdd: number
  /** Прибавка шанса крита (в процентных пунктах). */
  critChanceAdd: number
  /** Пассивная прибавка maxHp носителя (flat). */
  carrierHpAdd: number
  /** Пассивная прибавка защиты (flat). */
  defenseAdd: number
  /** Пассивная прибавка инициативы (flat). */
  initiativeAdd: number
  /** Самолечение при использовании (% от величины действия). */
  selfHealOnUsePct: number
  /** Вампиризм (% от нанесённого урона). */
  lifestealPct: number
  /** Отражение урона при получении удара (% от полученного). */
  reflectOnHitPct: number
  /** Самолечение при получении удара (% от полученного). */
  selfHealOnDamagedPct: number
  /** Доп. множитель урона по центру AoE. */
  aoeCenterDamageMult: number
  /** Доля splash-лечения соседям. */
  healSplashRatio: number
  /** Проки доп. ударов (независимые RNG, §16.12). */
  procExtraHits: { chance: number; hits: number }[]
}

export function emptyModEffects(): ModEffects {
  return {
    damageMult: 1,
    healMult: 1,
    rangeAdd: 0,
    cooldownAdd: 0,
    aoeSizeAdd: 0,
    critChanceAdd: 0,
    carrierHpAdd: 0,
    defenseAdd: 0,
    initiativeAdd: 0,
    selfHealOnUsePct: 0,
    lifestealPct: 0,
    reflectOnHitPct: 0,
    selfHealOnDamagedPct: 0,
    aoeCenterDamageMult: 1,
    healSplashRatio: 0,
    procExtraHits: [],
  }
}

function applyOp(eff: ModEffects, op: ModOp, lm: number): void {
  switch (op.kind) {
    case 'damage_mult':
      eff.damageMult += scaleByLm(op.base, lm) / 100
      break
    case 'heal_mult':
      eff.healMult += scaleByLm(op.base, lm) / 100
      break
    case 'range_add':
      eff.rangeAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'cooldown_add':
      eff.cooldownAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'aoe_size_add':
      eff.aoeSizeAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'crit_chance_add':
      eff.critChanceAdd += scaleByLm(op.base, lm)
      break
    case 'carrier_hp_add':
      eff.carrierHpAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'defense_add':
      eff.defenseAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'initiative_add':
      eff.initiativeAdd += Math.round(scaleByLm(op.base, lm))
      break
    case 'self_heal_on_use':
      eff.selfHealOnUsePct += scaleByLm(op.base, lm)
      break
    case 'lifesteal_pct':
      eff.lifestealPct += scaleByLm(op.base, lm)
      break
    case 'reflect_on_hit':
      eff.reflectOnHitPct += scaleByLm(op.base, lm)
      break
    case 'self_heal_on_damaged':
      eff.selfHealOnDamagedPct += scaleByLm(op.base, lm)
      break
    case 'aoe_center_damage_mult':
      eff.aoeCenterDamageMult += scaleByLm(op.base, lm) / 100
      break
    case 'heal_splash':
      eff.healSplashRatio += scaleByLm(op.splashRatio, lm)
      break
    case 'proc_extra_hit':
      // baseChance масштабируется по lm; число доп. ударов фиксировано
      eff.procExtraHits.push({
        chance: scaleByLm(op.baseChance, lm),
        hits: op.hits,
      })
      break
  }
}

/**
 * Собирает эффекты из набора filled-модов. Порядок слотов = ascending (§16.12).
 */
export function collectModEffects(mods: readonly ResolvedMod[]): ModEffects {
  const eff = emptyModEffects()
  for (const { template, lm } of mods) {
    for (const op of template.ops) applyOp(eff, op, lm)
  }
  return eff
}

/**
 * Разрешает filled-слоты носителя в ResolvedMod[] по реестру шаблонов.
 * Неизвестные/disabled шаблоны пропускаются.
 */
export function resolveCarrierMods(
  slots: readonly ModSlotState[],
  registry: ReadonlyMap<string, ModTemplate>,
): ResolvedMod[] {
  const out: ResolvedMod[] = []
  for (const slot of slots) {
    if (slot.status !== 'filled') continue
    const template = registry.get(slot.templateId)
    if (!template) continue
    out.push({ template, lm: slot.lm })
  }
  return out
}

/**
 * Бросок проков доп. ударов (§16.12.5: независимые RNG, порядок слотов = порядок
 * логов). Возвращает суммарное число доп. ударов.
 */
export function rollProcExtraHits(eff: ModEffects, rng: Rng): number {
  let extra = 0
  for (const proc of eff.procExtraHits) {
    if (rng.chance(proc.chance / 100)) extra += proc.hits
  }
  return extra
}

/** Финальный урон с учётом мультипликатора урона модов (§16.12). */
export function applyDamageMult(baseAmount: number, eff: ModEffects): number {
  return Math.max(0, Math.round(baseAmount * eff.damageMult))
}

/** Финальное лечение с учётом мультипликатора лечения модов. */
export function applyHealMult(baseAmount: number, eff: ModEffects): number {
  return Math.max(0, Math.round(baseAmount * eff.healMult))
}
