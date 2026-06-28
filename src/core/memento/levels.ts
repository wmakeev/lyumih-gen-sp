/**
 * Канонические броски уровня Memento Mori (§16.2, §16.3, §16.6).
 *
 * ВНИМАНИЕ: §16 — единственный нормативный раздел спеки. Эти функции должны
 * совпадать с ним побитово. Не «улучшать» формулы.
 */

import type { Rng } from '../rng'
import type { CardInstance, PassiveInstance } from '../types/memento'

/**
 * Возвращает true, если уровень повышается на +1.
 * @param currentLevel текущий уровень носителя
 * @param randomInt1to100 равномерное целое r ∈ [1..100]
 *
 * Кривая (§16.2): L=1 → 100%; L=50 → 51%; L=100 → 1%; L>100 → 1% (только r=1).
 */
export function rollCardLevelUp(currentLevel: number, randomInt1to100: number): boolean {
  const r = randomInt1to100
  if (currentLevel > 100) return r === 1 // P = 1%
  return r === 100 || r >= currentLevel
}

/** Алиас (§16.2): тот же бросок для L, Lm, itemLevel, unitLevel. */
export const rollMementoLevelUp = rollCardLevelUp

export interface LevelUpOptions {
  /** Склонность lucky_* даёт один повтор при провале (§16.3, §16.15). */
  lucky?: boolean
}

/**
 * Общий помощник: один бросок уровня с опциональным lucky-retry.
 * Возвращает true, если носитель должен подняться на +1.
 */
export function rollLevelUpWithLuck(
  currentLevel: number,
  rng: Rng,
  options?: LevelUpOptions,
): boolean {
  let leveled = rollMementoLevelUp(currentLevel, rng.d100())
  if (!leveled && options?.lucky) {
    leveled = rollMementoLevelUp(currentLevel, rng.d100())
  }
  return leveled
}

/**
 * Применение при использовании карты (§16.3). Мутирует и возвращает card.
 * Вызывающий код после изменения L должен выполнить syncModSlotsForLevel.
 */
export function applyCardUse(
  card: CardInstance,
  rng: Rng,
  options?: LevelUpOptions,
): CardInstance {
  card.uses_count += 1
  if (rollLevelUpWithLuck(card.global_level, rng, options)) {
    card.global_level += 1
  }
  return card
}

/**
 * Применение при успешном проке пассива (§16.5, §7.2: «proc — только при успехе»).
 * Мутирует и возвращает passive.
 */
export function applyPassiveProc(
  passive: PassiveInstance,
  rng: Rng,
  options?: LevelUpOptions,
): PassiveInstance {
  passive.uses_count += 1
  if (rollLevelUpWithLuck(passive.global_level, rng, options)) {
    passive.global_level += 1
  }
  return passive
}

// Рост itemLevel предмета (§16.5) живёт в memento/victory.ts → rollEquippedItemLevel
// (единственная реализация с guard'ом «кулаки itemLevel 0 не растут»).
