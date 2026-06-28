/**
 * Девять базовых статов (§5.1) и работа с ними.
 */

export type StatId =
  | 'health'
  | 'defense'
  | 'attack'
  | 'magicPower'
  | 'mana'
  | 'healPower'
  | 'speed'
  | 'initiative'
  | 'critChance'

export type StatBlock = Record<StatId, number>

export const STAT_IDS: readonly StatId[] = [
  'health',
  'defense',
  'attack',
  'magicPower',
  'mana',
  'healPower',
  'speed',
  'initiative',
  'critChance',
]

/**
 * RU-подписи статов (§5.4).
 *
 * ВНИМАНИЕ: поле `emoji` — legacy. Презентация переехала в UI-реестр
 * `src/ui/assets/icon-registry.ts` (план §D2): UI читает иконку по `statId`
 * через <Sprite> и НЕ опирается на это поле. Оставлено для обратной
 * совместимости (не использовать в новом коде).
 */
export const STAT_META: Record<StatId, { ru: string; emoji: string }> = {
  health: { ru: 'Здоровье', emoji: '❤️' },
  defense: { ru: 'Защита', emoji: '🛡️' },
  attack: { ru: 'Атака', emoji: '⚔️' },
  magicPower: { ru: 'Сила магии', emoji: '✨' },
  mana: { ru: 'Мана', emoji: '🔷' },
  healPower: { ru: 'Сила исцеления', emoji: '💚' },
  speed: { ru: 'Скорость', emoji: '👟' },
  initiative: { ru: 'Инициатива', emoji: '⚡' },
  critChance: { ru: 'Шанс крита', emoji: '🎯' },
}

export function zeroStats(): StatBlock {
  return {
    health: 0,
    defense: 0,
    attack: 0,
    magicPower: 0,
    mana: 0,
    healPower: 0,
    speed: 0,
    initiative: 0,
    critChance: 0,
  }
}

export function cloneStats(s: StatBlock): StatBlock {
  return { ...s }
}

export function addStats(a: StatBlock, b: Partial<StatBlock>): StatBlock {
  const out = cloneStats(a)
  for (const id of STAT_IDS) out[id] = a[id] + (b[id] ?? 0)
  return out
}

/**
 * Множитель силы из уровня и силы мира (§5.2, §13.2).
 * powerMult = 1 + 0.01·unitLevel + 0.01·worldPower
 */
export function powerMult(unitLevel: number, worldPower: number): number {
  return 1 + 0.01 * unitLevel + 0.01 * worldPower
}

/**
 * Effective stat юнита (§5.2): round(baseStat · powerMult).
 * Бонусы экипировки/пассивов/модов добавляются вызывающим кодом отдельно.
 */
export function effectiveStat(
  baseStat: number,
  unitLevel: number,
  worldPower: number,
): number {
  return Math.round(baseStat * powerMult(unitLevel, worldPower))
}

/** Все effective-статы юнита разом (без бонусов экипировки). */
export function effectiveStats(
  base: StatBlock,
  unitLevel: number,
  worldPower: number,
): StatBlock {
  const mult = powerMult(unitLevel, worldPower)
  const out = zeroStats()
  for (const id of STAT_IDS) out[id] = Math.round(base[id] * mult)
  return out
}
