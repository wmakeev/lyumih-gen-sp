/**
 * Регрессионные тесты на исправления code-review (review.md).
 * Покрывают находки #1 (финализация поражения), #2 (частота proc_extra_hit),
 * #3 (персист id-счётчика), #4 (statMods в боевой математике), #6 (павшие не
 * получают victory-награды).
 */
import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import { collectModEffects, rollProcExtraHits } from '../src/core/memento/mods'
import { effectiveStat } from '../src/core/battle/queue'
import { statBonus } from '../src/core/battle/damage'
import { nextId, getIdCounter, resetIdCounter } from '../src/core/campaign/ids'
import { createNewCampaign } from '../src/core/campaign/newgame'
import { startExpedition } from '../src/core/campaign/expedition'
import { finalizeDefeat } from '../src/core/campaign/finalize'
import { saveCampaign, loadCampaign, clearSave } from '../src/core/campaign/persistence'
import type { BattleUnit } from '../src/core/types/battle'
import type { CardTemplate } from '../src/core/types/cards'

const registry = buildContentRegistry()
const config = getProfile('development')

describe('#2 proc_extra_hit: частота прока соответствует процентным пунктам', () => {
  it('m_flurry (~25%) прокает на порядки чаще, чем при ошибочной доле 0.25%', () => {
    const tpl = registry.cardItemMods.get('m_flurry')!
    expect(tpl).toBeTruthy()
    const eff = collectModEffects([{ template: tpl, lm: 0 }])
    const rng = new SeededRng(123)
    let hits = 0
    const N = 4000
    for (let i = 0; i < N; i++) hits += rollProcExtraHits(eff, rng)
    const rate = hits / N
    // ожидаем ~0.25; баг давал ~0.0025. Широкая полоса, но ловит регрессию в 100×.
    expect(rate).toBeGreaterThan(0.15)
    expect(rate).toBeLessThan(0.35)
  })
})

describe('#3 id-счётчик переживает save/load', () => {
  it('после перезагрузки nextId не выдаёт занятые id', () => {
    resetIdCounter()
    const store = new Map<string, string>()
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage

    const rng = new SeededRng(7)
    const c = createNewCampaign(registry, config, rng)
    // сгенерируем несколько id, зафиксируем счётчик
    nextId('card')
    nextId('item')
    const counterBefore = getIdCounter()
    expect(counterBefore).toBeGreaterThan(0)

    saveCampaign(c)
    resetIdCounter(0) // имитируем перезапуск процесса
    loadCampaign()
    expect(getIdCounter()).toBe(counterBefore)

    // следующий id уникален относительно сохранённого диапазона
    const fresh = nextId('card')
    expect(fresh).toBe(`card_${(counterBefore + 1).toString(36)}`)
    clearSave()
  })
})

describe('#4 statMods статус-эффектов учитываются в боевой математике', () => {
  function unitWith(stats: Partial<BattleUnit['stats']>, statMods?: BattleUnit['statusEffects'][number]['statMods']): BattleUnit {
    return {
      id: 'u1',
      side: 'player',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      unitLevel: 1,
      initiativeBase: 0,
      stats: { health: 10, attack: 10, defense: 5, magicPower: 0, mana: 0, healPower: 0, speed: 3, initiative: 4, critChance: 0, ...stats },
      baseStats: { health: 10, attack: 10, defense: 5, magicPower: 0, mana: 0, healPower: 0, speed: 3, initiative: 4, critChance: 0 },
      displayName: 'U',
      iconEmoji: '🙂',
      statusEffects: statMods ? [{ id: 's', specId: 'x', remainingTurns: 2, statMods }] : [],
      cards: [],
      hasActedThisRound: false,
      hitsTaken: 0,
    }
  }

  it('дебаф attack снижает statBonus урона', () => {
    const card = { statSource: 'attack' } as CardTemplate
    const base = unitWith({ attack: 10 })
    const debuffed = unitWith({ attack: 10 }, { attack: -4 })
    expect(statBonus(base, card)).toBe(10)
    expect(statBonus(debuffed, card)).toBe(6)
  })

  it('баф defense повышает effectiveStat цели', () => {
    const buffed = unitWith({ defense: 5 }, { defense: 3 })
    expect(effectiveStat(buffed, 'defense')).toBe(8)
  })
})

describe('#1/#6 финализация поражения сохраняет death-roll/worldPower', () => {
  it('finalizeDefeat начисляет worldPower за убийства и запекает в снимок; награды не выдаются', () => {
    resetIdCounter()
    const rng = new SeededRng(999)
    const c = createNewCampaign(registry, config, rng)
    const heroId = c.characters[0]!.id
    const ok = startExpedition(c, {
      modeId: 'campaign-main',
      characterIds: [heroId],
      registry,
      rng,
      seed: 555,
    })
    expect(ok.ok).toBe(true)
    const battle = c.battle!

    const worldBefore = c.worldPower
    const goldBefore = c.gold
    // имитируем party-wipe с парой убитых врагов
    battle.enemyKills = 3
    for (const u of battle.units) if (u.side === 'player') u.hp = 0
    battle.phase = 'defeat'

    finalizeDefeat(c, registry, config, rng)

    // worldPower вырос на убийства и пережил «запекание» в снимок
    expect(c.worldPower).toBe(worldBefore + 3)
    expect(c.battleAttemptSnapshot!.worldPower).toBe(c.worldPower)
    // unitLevel павшего синхронизирован в снимок (death-roll переживёт retry)
    const snapHero = c.battleAttemptSnapshot!.characters.find((x) => x.id === heroId)!
    const liveHero = c.characters.find((x) => x.id === heroId)!
    expect(snapHero.unitLevel).toBe(liveHero.unitLevel)
    // награды поражения не начисляются
    expect(c.gold).toBe(goldBefore)
  })
})
