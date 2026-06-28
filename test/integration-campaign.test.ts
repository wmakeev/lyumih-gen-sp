import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import { resetIdCounter } from '../src/core/campaign/ids'
import { createNewCampaign } from '../src/core/campaign/newgame'
import { startExpedition, finishExpedition } from '../src/core/campaign/expedition'
import { finalizeBattle } from '../src/core/campaign/finalize'
import { takeAITurn } from '../src/core/battle/ai'
import { activeUnit } from '../src/core/battle/queue'
import type { BattleContext } from '../src/core/battle/engine'

function runBattleToEnd(campaign: ReturnType<typeof createNewCampaign>, ctx: BattleContext) {
  const battle = campaign.battle!
  let guard = 0
  while (battle.phase === 'ongoing' && guard < 5000) {
    guard++
    const unit = activeUnit(battle)
    if (!unit) break
    takeAITurn(battle, unit.id, ctx, unit.side === 'player' ? 'auto' : 'enemy')
  }
  return battle.phase
}

describe('сквозной цикл кампании', () => {
  it('новая игра → экспедиция → бой → финализация без ошибок', () => {
    resetIdCounter()
    const registry = buildContentRegistry()
    const config = getProfile('development')
    const rng = new SeededRng(12345)

    const campaign = createNewCampaign(registry, config, rng)
    expect(campaign.characters).toHaveLength(1)
    expect(campaign.squad[0]).toBe(campaign.characters[0]!.id)

    const heroId = campaign.characters[0]!.id
    const start = startExpedition(campaign, {
      modeId: 'campaign-main',
      characterIds: [heroId],
      registry,
      rng,
      seed: 777,
    })
    expect(start.ok).toBe(true)
    expect(campaign.battle).not.toBeNull()
    expect(campaign.phase).toBe('battle')

    const ctx: BattleContext = {
      cards: registry.cards,
      mods: registry.cardItemMods,
      rng,
    }
    const worldBefore = campaign.worldPower
    const phase = runBattleToEnd(campaign, ctx)
    expect(['victory', 'defeat']).toContain(phase)

    const goldBefore = campaign.gold
    const result = finalizeBattle(campaign, registry, config, rng, 100)
    // worldPower растёт на число убитых врагов
    expect(campaign.worldPower).toBeGreaterThanOrEqual(worldBefore)
    if (phase === 'victory') {
      expect(campaign.gold).toBeGreaterThanOrEqual(goldBefore)
    }
    expect(result).toBeTruthy()

    finishExpedition(campaign)
    expect(campaign.phase).toBe('hub')
    expect(campaign.expedition).toBeNull()
  })

  it('retry восстанавливает снимок (анти-дюп §15)', async () => {
    resetIdCounter()
    const { retryCurrentBattle } = await import('../src/core/campaign/expedition')
    const registry = buildContentRegistry()
    const config = getProfile('development')
    const rng = new SeededRng(42)
    const campaign = createNewCampaign(registry, config, rng)
    const heroId = campaign.characters[0]!.id
    startExpedition(campaign, { modeId: 'test-single-battle', characterIds: [heroId], registry, rng, seed: 1 })

    const goldAtStart = campaign.gold
    campaign.gold += 999 // имитируем изменение во время попытки
    const ok = retryCurrentBattle(campaign, registry, rng)
    expect(ok).toBe(true)
    expect(campaign.gold).toBe(goldAtStart) // снимок восстановлен
  })
})
