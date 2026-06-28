/**
 * Roll базовых статов кандидата по классу (§5.3).
 *  - primary: +50% верхней границы; secondary: +25%.
 *  - значение может превышать config max (jackpot).
 *  - baseStatRating = среднее качество roll (0..1+), для звёзд UI (§5.4).
 * Конкретные диапазоны — балансовая свобода (§0).
 */

import type { Rng } from '../rng'
import type { ClassDef } from '../types/character'
import { STAT_IDS, zeroStats, type StatBlock, type StatId } from '../types/stats'

/** Базовые диапазоны roll по статам (min..max). */
export const STAT_ROLL_RANGE: Record<StatId, { min: number; max: number }> = {
  health: { min: 20, max: 50 },
  defense: { min: 0, max: 8 },
  attack: { min: 2, max: 12 },
  magicPower: { min: 2, max: 12 },
  mana: { min: 5, max: 20 },
  healPower: { min: 0, max: 10 },
  speed: { min: 2, max: 5 },
  initiative: { min: 5, max: 20 },
  critChance: { min: 0, max: 15 },
}

const PRIMARY_BONUS = 0.5
const SECONDARY_BONUS = 0.25
/** Малый шанс jackpot — выход за верхнюю границу. */
const JACKPOT_CHANCE = 0.05
const JACKPOT_EXTRA = 0.3

export interface RolledStats {
  stats: StatBlock
  rating: number
}

export function rollCandidateStats(cls: ClassDef, rng: Rng): RolledStats {
  const out = zeroStats()
  const primary = new Set(cls.primaryStats)
  const secondary = new Set(cls.secondaryStats)
  let qualitySum = 0

  for (const id of STAT_IDS) {
    const range = STAT_ROLL_RANGE[id]
    let upper = range.max
    if (primary.has(id)) upper = Math.round(upper * (1 + PRIMARY_BONUS))
    else if (secondary.has(id)) upper = Math.round(upper * (1 + SECONDARY_BONUS))

    const t = rng.nextFloat()
    let value = Math.round(range.min + t * (upper - range.min))

    if (rng.chance(JACKPOT_CHANCE)) {
      value = Math.round(value * (1 + JACKPOT_EXTRA))
    }
    out[id] = value
    // качество относительно «обычного» max (без бонуса) — может быть >1
    qualitySum += value / Math.max(1, range.max)
  }

  const rating = qualitySum / STAT_IDS.length
  return { stats: out, rating }
}
