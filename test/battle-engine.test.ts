import { describe, it, expect } from 'vitest'
import {
  startBattle,
  applyMove,
  basicAttack,
  useCard,
  endTurn,
  healUnit,
  checkBattleEnd,
} from '../src/core/battle/engine'
import { computeTurnOrder } from '../src/core/battle/queue'
import {
  makeUnit,
  makeState,
  makeContext,
  makeCard,
  stats,
  STRIKE_CARD,
} from './helpers/battle-fixtures'
import type { CardTemplate } from '../src/core/types/cards'

describe('очередь хода (§6.3)', () => {
  it('сортировка по убыванию инициативы, downed исключены', () => {
    const a = makeUnit({ id: 'a', stats: stats({ initiative: 5 }) })
    const b = makeUnit({ id: 'b', stats: stats({ initiative: 20 }) })
    const dead = makeUnit({ id: 'c', stats: stats({ initiative: 99 }), hp: 0 })
    const order = computeTurnOrder([a, b, dead])
    expect(order).toEqual(['b', 'a'])
  })
})

describe('перемещение (§6.4)', () => {
  it('двигается в пределах speed, иначе отказ', () => {
    const u = makeUnit({ id: 'u', x: 0, y: 0, stats: stats({ speed: 2 }) })
    const st = makeState([u])
    expect(applyMove(st, 'u', { x: 2, y: 0 })).toBe(true)
    expect(u.x).toBe(2)
    expect(applyMove(st, 'u', { x: 9, y: 9 })).toBe(false)
  })
})

describe('базовая атака, defense, kill (§6.6, §6.9)', () => {
  it('strike наносит урон с учётом защиты; убийство копит worldPower', () => {
    const hero = makeUnit({
      id: 'hero',
      side: 'player',
      x: 0,
      y: 0,
      stats: stats({ attack: 10, initiative: 50 }),
    })
    const foe = makeUnit({
      id: 'foe',
      side: 'enemy',
      x: 1,
      y: 0,
      hp: 6,
      maxHp: 6,
      stats: stats({ defense: 4, health: 6, initiative: 1 }),
    })
    const st = makeState([hero, foe])
    const ctx = makeContext([STRIKE_CARD], [], 1)
    // base = skillFlat 5 + 0%% + attack 10 = 15; defense 4 → 11 (без крита) → foe 6hp умирает
    basicAttack(st, 'hero', 'foe', ctx)
    expect(foe.hp).toBe(0)
    expect(st.enemyKills).toBe(1)
  })
})

describe('исход боя (§6.8)', () => {
  it('все враги повержены → victory', () => {
    const hero = makeUnit({ id: 'h', side: 'player', hp: 10 })
    const foe = makeUnit({ id: 'f', side: 'enemy', hp: 0 })
    const st = makeState([hero, foe])
    expect(checkBattleEnd(st)).toBe(true)
    expect(st.phase).toBe('victory')
  })
  it('все союзники повержены → defeat', () => {
    const hero = makeUnit({ id: 'h', side: 'player', hp: 0 })
    const foe = makeUnit({ id: 'f', side: 'enemy', hp: 10 })
    const st = makeState([hero, foe])
    expect(checkBattleEnd(st)).toBe(true)
    expect(st.phase).toBe('defeat')
  })
})

describe('лечение и downed (§6.7)', () => {
  it('лечение выше 0 поднимает downed', () => {
    const u = makeUnit({ id: 'u', hp: 0, maxHp: 20 })
    const st = makeState([u, makeUnit({ id: 'e', side: 'enemy' })])
    healUnit(st, u, 8, 'жрец')
    expect(u.hp).toBe(8)
  })
})

describe('cooldown карты (§6.5)', () => {
  it('после применения карта на перезарядке, restored через ходы', () => {
    const fireball: CardTemplate = {
      id: 'fireball',
      label: 'Огненный шар',
      kind: 'ranged',
      maxRange: 5,
      statSource: 'magicPower',
      skillFlat: 8,
      scaleToken: '0%%',
      cooldownTurns: 2,
      tags: ['ranged', 'skill'],
    }
    const hero = makeUnit({
      id: 'h',
      side: 'player',
      x: 0,
      y: 0,
      stats: stats({ magicPower: 5, initiative: 50 }),
      cards: [makeCard({ instanceId: 'fb', templateId: 'fireball', cooldownTurns: 2 })],
    })
    const foe = makeUnit({
      id: 'e',
      side: 'enemy',
      x: 3,
      y: 0,
      hp: 100,
      maxHp: 100,
      stats: stats({ health: 100, initiative: 1 }),
    })
    const st = makeState([hero, foe])
    const ctx = makeContext([fireball], [], 5)
    startBattle(st)
    const res = useCard(st, 'h', 'fb', { unitId: 'e' }, ctx)
    expect(res.ok).toBe(true)
    const card = hero.cards[0]!
    expect(card.cooldownLeft).toBe(2)
    expect(foe.hp).toBeLessThan(100)
    // повторно нельзя — на перезарядке
    expect(useCard(st, 'h', 'fb', { unitId: 'e' }, ctx).ok).toBe(false)
  })
})

describe('раунды и onTurnStart', () => {
  it('startBattle строит очередь и стартует раунд 1', () => {
    const a = makeUnit({ id: 'a', side: 'player', stats: stats({ initiative: 30 }) })
    const b = makeUnit({ id: 'b', side: 'enemy', stats: stats({ initiative: 10 }) })
    const st = makeState([a, b])
    startBattle(st)
    expect(st.round).toBe(1)
    expect(st.turnOrder[0]).toBe('a')
    endTurn(st)
    expect(st.turnOrder[st.activeIndex]).toBe('b')
  })
})
