/**
 * Действия игрока над слотами модов носителей (§16.8–16.9.1):
 * pickCarrierMod / removeCarrierMod поверх ядра memento/slots.
 */
import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import { createNewCampaign } from '../src/core/campaign/newgame'
import { createCardInstance } from '../src/core/campaign/instances'
import { syncModSlotsForLevel } from '../src/core/memento/slots'
import { pickCarrierMod, removeCarrierMod } from '../src/core/campaign/mods'
import { resetIdCounter } from '../src/core/campaign/ids'

const registry = buildContentRegistry()
const config = getProfile('development') // firstThreshold 5, step 5

function setupCharWithCard() {
  resetIdCounter()
  const rng = new SeededRng(11)
  const c = createNewCampaign(registry, config, rng)
  const ch = c.characters[0]!
  // не-strike умение с тегами для оффера
  const tplId = [...registry.cards.values()].find((t) => t.id !== 'strike' && t.enabled !== false)!.id
  const card = createCardInstance(tplId)
  card.global_level = 5 // открыт ровно 1 слот (веха L5)
  ch.cards.push(card)
  syncModSlotsForLevel(card.modSlots, card.global_level, {
    carrierTags: registry.cards.get(tplId)?.tags ?? ['skill'],
    pool: [...registry.cardItemMods.values()],
    milestones: config.modSlotMilestones,
    offerCount: 3,
    rng,
  })
  return { ch, card }
}

describe('pickCarrierMod', () => {
  it('заполняет пустой слот выбранным из оффера модом (lm=0)', () => {
    const { ch, card } = setupCharWithCard()
    expect(card.modSlots.length).toBe(1)
    const slot = card.modSlots[0]!
    expect(slot.status).toBe('empty')
    const tid = slot.status === 'empty' ? slot.offer!.modIds[0]! : ''
    const ok = pickCarrierMod(ch, 'card', card.id, 0, tid, registry)
    expect(ok).toBe(true)
    expect(card.modSlots[0]).toMatchObject({ status: 'filled', templateId: tid, lm: 0 })
  })

  it('отклоняет мод не из оффера и повторный выбор занятого слота', () => {
    const { ch, card } = setupCharWithCard()
    const slot0 = card.modSlots[0]!
    const tid = slot0.status === 'empty' ? slot0.offer!.modIds[0]! : ''
    expect(pickCarrierMod(ch, 'card', card.id, 0, 'm_not_in_offer', registry)).toBe(false)
    expect(pickCarrierMod(ch, 'card', card.id, 0, tid, registry)).toBe(true)
    // слот уже filled — повтор отклонён
    expect(pickCarrierMod(ch, 'card', card.id, 0, tid, registry)).toBe(false)
  })

  it('false для отсутствующего носителя', () => {
    const { ch } = setupCharWithCard()
    expect(pickCarrierMod(ch, 'card', 'нет-такого', 0, 'x', registry)).toBe(false)
  })
})

describe('removeCarrierMod', () => {
  it('снимает мод: слот → empty с новым оффером, уровень откатан к полу вехи', () => {
    const { ch, card } = setupCharWithCard()
    const slot0 = card.modSlots[0]!
    const tid = slot0.status === 'empty' ? slot0.offer!.modIds[0]! : ''
    pickCarrierMod(ch, 'card', card.id, 0, tid, registry)
    expect(card.modSlots[0]!.status).toBe('filled')

    const rng = new SeededRng(5)
    const ok = removeCarrierMod(ch, 'card', card.id, 0, registry, config, rng)
    expect(ok).toBe(true)
    const after = card.modSlots[0]!
    expect(after.status).toBe('empty')
    // слот 0 → пол = 0 (§16.9.1)
    expect(card.global_level).toBe(0)
    // выдан свежий оффер
    expect(after.status === 'empty' && (after.offer?.modIds.length ?? 0)).toBeGreaterThan(0)
  })

  it('false при попытке снять из пустого слота', () => {
    const { ch, card } = setupCharWithCard()
    const rng = new SeededRng(5)
    expect(removeCarrierMod(ch, 'card', card.id, 0, registry, config, rng)).toBe(false)
  })
})
