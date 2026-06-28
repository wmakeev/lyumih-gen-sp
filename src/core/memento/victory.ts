/**
 * Броски Memento при завершении боя (§16.6–16.7).
 *
 * Эти функции — чистая оркестрация бросков уровня над инстансами носителей.
 * Привязка к CampaignState/Character происходит в слое кампании (Этап 3).
 */

import type { Rng } from '../rng'
import { rollLevelUpWithLuck, type LevelUpOptions } from './levels'
import type { ItemInstance, ModSlotState } from '../types/memento'

/** §16.7 шаг 3 / §16.1: бросок Lm каждого filled-слота. Мутирует слоты. */
export function rollFilledModSlots(slots: ModSlotState[], rng: Rng): number {
  let upgrades = 0
  for (const slot of slots) {
    if (slot.status !== 'filled') continue
    if (rollLevelUpWithLuck(slot.lm, rng)) {
      slot.lm += 1
      upgrades++
    }
  }
  return upgrades
}

/** §16.7 шаг 1: бросок L надетого предмета (weapon→armor→accessory). */
export function rollEquippedItemLevel(
  item: ItemInstance,
  rng: Rng,
  opts?: LevelUpOptions,
): boolean {
  // «Кулаки» (itemLevel 0) не прогрессируют (§16.5)
  if (item.itemLevel <= 0) return false
  if (rollLevelUpWithLuck(item.itemLevel, rng, opts)) {
    item.itemLevel += 1
    return true
  }
  return false
}

/** §16.7 шаг 2 / §16.6: бросок unitLevel героя. Возвращает новый уровень. */
export function rollUnitLevel(
  unitLevel: number,
  rng: Rng,
  opts?: LevelUpOptions,
): number {
  return rollLevelUpWithLuck(unitLevel, rng, opts) ? unitLevel + 1 : unitLevel
}
