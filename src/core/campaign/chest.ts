/**
 * Операции с сундуком кампании (§8.5): bind умений/пассивов к герою,
 * перемещение предметов сундук ↔ персонаж.
 */

import type { CampaignState } from '../types/campaign'
import type { Character } from '../types/character'

function findChar(c: CampaignState, id: string): Character | undefined {
  return c.characters.find((ch) => ch.id === id)
}

/** BIND_CHEST_CARD: привязка умения из сундука к герою (необратимо §8.5). */
export function bindChestCard(
  c: CampaignState,
  cardInstanceId: string,
  characterId: string,
): boolean {
  const idx = c.chest.unboundCards.findIndex((x) => x.id === cardInstanceId)
  const ch = findChar(c, characterId)
  if (idx < 0 || !ch) return false
  const [card] = c.chest.unboundCards.splice(idx, 1)
  ch.cards.push(card!)
  return true
}

/** BIND_CHEST_PASSIVE: привязка пассива (≤4 владения, §7.2). */
export function bindChestPassive(
  c: CampaignState,
  passiveInstanceId: string,
  characterId: string,
  maxOwned: number,
): boolean {
  const ch = findChar(c, characterId)
  if (!ch || ch.passives.length >= maxOwned) return false
  const idx = c.chest.unboundPassives.findIndex((x) => x.id === passiveInstanceId)
  if (idx < 0) return false
  const [p] = c.chest.unboundPassives.splice(idx, 1)
  ch.passives.push(p!)
  return true
}

/** Предмет: сундук → персонаж. */
export function moveItemToCharacter(
  c: CampaignState,
  itemInstanceId: string,
  characterId: string,
): boolean {
  const idx = c.chest.items.findIndex((x) => x.id === itemInstanceId)
  const ch = findChar(c, characterId)
  if (idx < 0 || !ch) return false
  const [item] = c.chest.items.splice(idx, 1)
  ch.items.push(item!)
  return true
}

/** Предмет: персонаж → сундук (если не надет). */
export function moveItemToChest(
  c: CampaignState,
  itemInstanceId: string,
  characterId: string,
): boolean {
  const ch = findChar(c, characterId)
  if (!ch) return false
  const equipped =
    ch.equipment.weapon === itemInstanceId ||
    ch.equipment.armor === itemInstanceId ||
    ch.equipment.accessory === itemInstanceId
  if (equipped) return false
  const idx = ch.items.findIndex((x) => x.id === itemInstanceId)
  if (idx < 0) return false
  const [item] = ch.items.splice(idx, 1)
  c.chest.items.push(item!)
  return true
}
