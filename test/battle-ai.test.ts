import { describe, it, expect } from 'vitest'
import { planAction, takeAITurn } from '../src/core/battle/ai'
import { startBattle, useCard } from '../src/core/battle/engine'
import {
  makeUnit,
  makeState,
  makeContext,
  makeCard,
  stats,
  STRIKE_CARD,
} from './helpers/battle-fixtures'
import type { CardTemplate } from '../src/core/types/cards'

const FIREBALL: CardTemplate = {
  id: 'fireball',
  label: 'Огненный шар',
  kind: 'ranged',
  maxRange: 6,
  statSource: 'magicPower',
  skillFlat: 12,
  scaleToken: '0%%',
  cooldownTurns: 2,
  tags: ['ranged', 'skill'],
}

describe('AI планирование (§6.11)', () => {
  it('двигается к врагу, если вне дальности', () => {
    const enemy = makeUnit({ id: 'e', side: 'enemy', x: 0, y: 0, stats: stats({ speed: 3 }) })
    const hero = makeUnit({ id: 'h', side: 'player', x: 8, y: 0, hp: 50, maxHp: 50 })
    const st = makeState([enemy, hero])
    const ctx = makeContext([STRIKE_CARD], [], 3)
    const action = planAction(st, 'e', ctx, 'enemy')
    expect(action.type).toBe('move')
  })

  it('бьёт базовой атакой вплотную', () => {
    const enemy = makeUnit({ id: 'e', side: 'enemy', x: 0, y: 0 })
    const hero = makeUnit({ id: 'h', side: 'player', x: 1, y: 0, hp: 50, maxHp: 50 })
    const st = makeState([enemy, hero])
    const ctx = makeContext([STRIKE_CARD], [], 3)
    const action = planAction(st, 'e', ctx, 'enemy')
    expect(action.type).toBe('basic')
  })

  it('предпочитает атакующую карту по приоритету', () => {
    const enemy = makeUnit({
      id: 'e',
      side: 'enemy',
      x: 0,
      y: 0,
      stats: stats({ magicPower: 8 }),
      skillPriorities: ['fireball'],
      cards: [
        makeUnit().cards[0]!, // strike
        makeCard({ instanceId: 'fb', templateId: 'fireball' }),
      ],
    })
    const hero = makeUnit({ id: 'h', side: 'player', x: 3, y: 0, hp: 50, maxHp: 50 })
    const st = makeState([enemy, hero])
    const ctx = makeContext([STRIKE_CARD, FIREBALL], [], 3)
    const action = planAction(st, 'e', ctx, 'enemy')
    expect(action.type).toBe('card')
    if (action.type === 'card') expect(action.instanceId).toBe('fb')
  })

  it('takeAITurn исполняет действие и завершает ход', () => {
    const enemy = makeUnit({ id: 'e', side: 'enemy', x: 1, y: 0, stats: stats({ attack: 8, initiative: 50 }) })
    const hero = makeUnit({ id: 'h', side: 'player', x: 0, y: 0, hp: 8, maxHp: 8, stats: stats({ health: 8, initiative: 1 }) })
    const st = makeState([enemy, hero])
    const ctx = makeContext([STRIKE_CARD], [], 7)
    startBattle(st)
    takeAITurn(st, 'e', ctx, 'enemy')
    expect(hero.hp).toBeLessThan(8)
  })
})

describe('AoE урон (§6.5)', () => {
  it('aoe бьёт всех врагов в радиусе', () => {
    const blast: CardTemplate = {
      id: 'blast',
      label: 'Взрыв',
      kind: 'aoe',
      maxRange: 5,
      statSource: 'magicPower',
      skillFlat: 10,
      scaleToken: '0%%',
      cooldownTurns: 3,
      tags: ['aoe', 'skill'],
      aoeRadius: 1,
    }
    const mage = makeUnit({
      id: 'm',
      side: 'player',
      x: 0,
      y: 0,
      stats: stats({ magicPower: 5, initiative: 50 }),
      cards: [makeCard({ instanceId: 'bl', templateId: 'blast', kind: 'aoe' })],
    })
    const e1 = makeUnit({ id: 'e1', side: 'enemy', x: 3, y: 0, hp: 40, maxHp: 40, stats: stats({ health: 40 }) })
    const e2 = makeUnit({ id: 'e2', side: 'enemy', x: 3, y: 1, hp: 40, maxHp: 40, stats: stats({ health: 40 }) })
    const st = makeState([mage, e1, e2])
    const ctx = makeContext([blast], [], 9)
    // целимся в клетку (3,0) — e2 в радиусе 1
    const res = useCard(st, 'm', 'bl', { cell: { x: 3, y: 0 } }, ctx)
    expect(res.ok).toBe(true)
    expect(e1.hp).toBeLessThan(40)
    expect(e2.hp).toBeLessThan(40)
  })
})
