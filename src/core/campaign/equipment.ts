/**
 * Экипировка (§8.3): надеть/снять предмет на персонаже.
 */

import type { Character } from '../types/character'
import type { ContentRegistry } from '../types/content'

/** Надеть предмет (только совместимый слот; замена атомарна). */
export function equipItem(
  ch: Character,
  itemInstanceId: string,
  registry: ContentRegistry,
): boolean {
  const item = ch.items.find((i) => i.id === itemInstanceId)
  if (!item) return false
  const tpl = registry.items.get(item.templateId)
  if (!tpl) return false
  ch.equipment[tpl.slot] = item.id
  return true
}

/** Снять предмет из слота (остаётся в items, §8.3). */
export function unequipSlot(ch: Character, slot: 'weapon' | 'armor' | 'accessory'): void {
  ch.equipment[slot] = null
}
