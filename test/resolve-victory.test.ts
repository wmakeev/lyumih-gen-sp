import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import { resetIdCounter } from '../src/core/campaign/ids'
import { createNewCampaign } from '../src/core/campaign/newgame'
import { startExpedition } from '../src/core/campaign/expedition'
import { resolveVictory } from '../src/core/campaign/finalize'

const registry = buildContentRegistry()
const config = getProfile('development')

function setupVictory(seed: number) {
  resetIdCounter()
  const rng = new SeededRng(seed)
  const c = createNewCampaign(registry, config, rng)
  const heroId = c.characters[0]!.id
  startExpedition(c, { modeId: 'campaign-main', characterIds: [heroId], registry, rng, seed: 1 })
  // симулируем выигранный бой, не проигрывая его (resolveVictory ветвится по phase)
  c.battle!.phase = 'victory'
  return { c, rng }
}

describe('resolveVictory (§16.6–16.7 + §12.3)', () => {
  it('есть следующий бой → inter_battle, scenarioIndex не растёт, магазин не обновляется', () => {
    const { c, rng } = setupVictory(101)
    c.expedition!.battleIndex = 0
    c.expedition!.battleCount = 2 // есть ещё бой
    const scenarioBefore = c.scenarioIndex
    const shopBefore = c.shopOffers

    const res = resolveVictory(c, registry, config, rng)

    expect(res.phase).toBe('inter_battle')
    expect(c.phase).toBe('inter_battle')
    expect(res.returnedToHub).toBe(false)
    expect(c.expedition).not.toBeNull() // цепочка продолжается
    expect(c.battle).toBeNull()
    expect(c.scenarioIndex).toBe(scenarioBefore) // без инкремента
    expect(c.shopOffers).toBe(shopBefore) // магазин не тронут
  })

  it('последний бой → finish-expedition, scenarioIndex +1, магазин обновлён', () => {
    const { c, rng } = setupVictory(202)
    c.expedition!.battleIndex = 0
    c.expedition!.battleCount = 1 // это последний бой
    const scenarioBefore = c.scenarioIndex
    c.shopOffers = null

    const res = resolveVictory(c, registry, config, rng)

    expect(res.phase).toBe('hub')
    expect(c.phase).toBe('hub')
    expect(res.returnedToHub).toBe(true)
    expect(c.expedition).toBeNull() // экспедиция завершена
    expect(c.battle).toBeNull()
    expect(c.scenarioIndex).toBe(scenarioBefore + 1) // инкремент на завершении цепочки
    expect(c.shopOffers).not.toBeNull() // магазин перегенерирован
  })

  it('pendingHubNotice выставляется из finalizeBattle', () => {
    const { c, rng } = setupVictory(303)
    c.expedition!.battleIndex = 0
    c.expedition!.battleCount = 1
    const res = resolveVictory(c, registry, config, rng)
    // notice в результате совпадает с записанным в кампанию (может быть null)
    expect(c.pendingHubNotice).toBe(res.notice)
  })
})
