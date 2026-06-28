/**
 * Магазин (§9.2): генерация офферов, покупка/продажа/обновление.
 */

import type { Rng } from '../rng'
import type { GameConfig } from '../config'
import type { CampaignState, ShopOffer } from '../types/campaign'
import type { ContentRegistry } from '../types/content'
import { createCardInstance, createItemInstance, createPassiveInstance } from './instances'

const SELL_RATIO = 0.5

export function generateShopOffer(
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): ShopOffer {
  const itemTemplates = [...registry.items.values()]
  const items: ShopOffer['items'] = []
  for (let i = 0; i < config.shop.itemSlots && itemTemplates.length > 0; i++) {
    const tpl = rng.pick(itemTemplates)
    items.push({ instance: createItemInstance(tpl.id), price: tpl.shopPrice })
  }

  let card: ShopOffer['card'] = null
  if (rng.chance(config.shop.cardOfferChance)) {
    const pool = [...registry.cards.values()].filter(
      (c) => c.id !== 'strike' && c.enabled !== false,
    )
    if (pool.length > 0)
      card = { instance: createCardInstance(rng.pick(pool).id), price: config.shop.cardPrice }
  }

  let passive: ShopOffer['passive'] = null
  if (rng.chance(config.shop.passiveOfferChance)) {
    const pool = [...registry.passives.values()].filter((p) => !p.isEnemy)
    if (pool.length > 0)
      passive = {
        instance: createPassiveInstance(rng.pick(pool).id),
        price: config.shop.cardPrice,
      }
  }

  return { items, card, passive }
}

/** Купить предмет: в сундук (§9.2). Возвращает успех. */
export function buyItem(c: CampaignState, itemInstanceId: string): boolean {
  if (!c.shopOffers) return false
  const idx = c.shopOffers.items.findIndex((o) => o.instance.id === itemInstanceId)
  if (idx < 0) return false
  const offer = c.shopOffers.items[idx]!
  if (c.gold < offer.price) return false
  c.gold -= offer.price
  c.chest.items.push(offer.instance)
  c.shopOffers.items.splice(idx, 1)
  return true
}

/** Купить умение → сундук (§9.2). */
export function buyCard(c: CampaignState): boolean {
  if (!c.shopOffers?.card || c.gold < c.shopOffers.card.price) return false
  c.gold -= c.shopOffers.card.price
  c.chest.unboundCards.push(c.shopOffers.card.instance)
  c.shopOffers.card = null
  return true
}

/** Купить пассив → сундук (§9.2). */
export function buyPassive(c: CampaignState): boolean {
  if (!c.shopOffers?.passive || c.gold < c.shopOffers.passive.price) return false
  c.gold -= c.shopOffers.passive.price
  c.chest.unboundPassives.push(c.shopOffers.passive.instance)
  c.shopOffers.passive = null
  return true
}

/** Цена продажи предмета из сундука (§9.2). */
export function sellPrice(c: CampaignState, itemTemplatePrice: number): number {
  void c
  return Math.round(itemTemplatePrice * SELL_RATIO)
}

/** Продать предмет из сундука. */
export function sellChestItem(
  c: CampaignState,
  itemInstanceId: string,
  registry: ContentRegistry,
): boolean {
  const idx = c.chest.items.findIndex((i) => i.id === itemInstanceId)
  if (idx < 0) return false
  const item = c.chest.items[idx]!
  const tpl = registry.items.get(item.templateId)
  if (!tpl) return false
  c.gold += sellPrice(c, tpl.shopPrice)
  c.chest.items.splice(idx, 1)
  return true
}

/** Обновить магазин за золото (§9.2). */
export function refreshShop(
  c: CampaignState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): boolean {
  if (c.gold < config.shop.refreshCost) return false
  c.gold -= config.shop.refreshCost
  c.shopOffers = generateShopOffer(registry, config, rng)
  return true
}
