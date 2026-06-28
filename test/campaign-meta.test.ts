import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import { resetIdCounter } from '../src/core/campaign/ids'
import { createNewCampaign } from '../src/core/campaign/newgame'
import { generateTavern, hireFromTavern } from '../src/core/campaign/tavern'
import { generateShopOffer, buyItem, sellChestItem } from '../src/core/campaign/shop'
import { bindChestCard } from '../src/core/campaign/chest'
import { createCardInstance } from '../src/core/campaign/instances'
import { saveCampaign, loadCampaign, clearSave } from '../src/core/campaign/persistence'

const registry = buildContentRegistry()
const config = getProfile('development')

describe('таверна (§10)', () => {
  it('найм добавляет персонажа и списывает золото', () => {
    resetIdCounter()
    const rng = new SeededRng(1)
    const c = createNewCampaign(registry, config, rng)
    c.gold = 100000
    c.tavernCandidates = generateTavern(registry, rng, 4)
    const before = c.characters.length
    const cand = c.tavernCandidates[0]!
    const res = hireFromTavern(c, cand.id, registry, rng)
    expect(res.ok).toBe(true)
    expect(c.characters.length).toBe(before + 1)
    // склонность раскрыта = hiddenSpecializationId кандидата
    const hired = c.characters[c.characters.length - 1]!
    expect(hired.specializationId).toBe(cand.hiddenSpecializationId)
  })
})

describe('магазин (§9)', () => {
  it('покупка предмета кладёт его в сундук', () => {
    resetIdCounter()
    const rng = new SeededRng(2)
    const c = createNewCampaign(registry, config, rng)
    c.gold = 100000
    c.shopOffers = generateShopOffer(registry, config, rng)
    const offer = c.shopOffers.items[0]
    if (!offer) return
    const before = c.chest.items.length
    expect(buyItem(c, offer.instance.id)).toBe(true)
    expect(c.chest.items.length).toBe(before + 1)
  })

  it('продажа предмета из сундука даёт золото', () => {
    resetIdCounter()
    const rng = new SeededRng(3)
    const c = createNewCampaign(registry, config, rng)
    const tpl = [...registry.items.values()][0]!
    c.chest.items.push({ id: 'it1', templateId: tpl.id, itemLevel: 1, modSlots: [] })
    const goldBefore = c.gold
    expect(sellChestItem(c, 'it1', registry)).toBe(true)
    expect(c.gold).toBeGreaterThan(goldBefore)
  })
})

describe('сундук bind (§8.5)', () => {
  it('bind карты переносит её герою', () => {
    resetIdCounter()
    const rng = new SeededRng(4)
    const c = createNewCampaign(registry, config, rng)
    const nonStrike = [...registry.cards.values()].find((x) => x.id !== 'strike')!
    const card = createCardInstance(nonStrike.id)
    c.chest.unboundCards.push(card)
    const hero = c.characters[0]!
    const before = hero.cards.length
    expect(bindChestCard(c, card.id, hero.id)).toBe(true)
    expect(hero.cards.length).toBe(before + 1)
    expect(c.chest.unboundCards).toHaveLength(0)
  })
})

describe('персистентность (§15)', () => {
  it('save→load round-trip восстанавливает кампанию', () => {
    resetIdCounter()
    // имитация localStorage в Node
    const store = new Map<string, string>()
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage

    const rng = new SeededRng(5)
    const c = createNewCampaign(registry, config, rng)
    c.gold = 4242
    saveCampaign(c)
    const loaded = loadCampaign()
    expect(loaded).not.toBeNull()
    expect(loaded!.gold).toBe(4242)
    expect(loaded!.characters).toHaveLength(c.characters.length)
    clearSave()
    expect(loadCampaign()).toBeNull()
  })
})
