/**
 * Фабрики для тестов боя: поле, юниты, карты, контекст.
 */

import type {
  BattleField,
  BattleState,
  BattleUnit,
  BattleCard,
  Terrain,
} from '../../src/core/types/battle'
import type { CardTemplate } from '../../src/core/types/cards'
import type { ModTemplate } from '../../src/core/types/memento'
import { zeroStats, type StatBlock } from '../../src/core/types/stats'
import { SeededRng } from '../../src/core/rng'
import type { BattleContext } from '../../src/core/battle/engine'

export function makeField(width: number, height: number, walls: [number, number][] = []): BattleField {
  const terrain: Terrain[] = new Array(width * height).fill('floor')
  for (const [x, y] of walls) terrain[y * width + x] = 'wall'
  return { width, height, terrain }
}

export function stats(overrides: Partial<StatBlock> = {}): StatBlock {
  return { ...zeroStats(), speed: 3, initiative: 10, health: 30, ...overrides }
}

export const STRIKE_CARD: CardTemplate = {
  id: 'strike',
  label: 'Удар',
  kind: 'melee',
  maxRange: 1,
  statSource: 'attack',
  skillFlat: 5,
  scaleToken: '0%%',
  cooldownTurns: 0,
  tags: ['melee', 'attack', 'weapon'],
}

export function makeBasicCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    instanceId: 'strike-inst',
    templateId: 'strike',
    kind: 'melee',
    level: 1,
    uses: 0,
    damageLevelBonus: 0,
    cooldownLeft: 0,
    cooldownTurns: 0,
    modSlots: [],
    carrierTags: ['weapon'],
    isBasic: true,
    ...overrides,
  }
}

export function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    instanceId: 'card-inst',
    templateId: 'fireball',
    kind: 'ranged',
    level: 1,
    uses: 0,
    damageLevelBonus: 0,
    cooldownLeft: 0,
    cooldownTurns: 2,
    modSlots: [],
    carrierTags: ['ranged', 'skill'],
    isBasic: false,
    ...overrides,
  }
}

let unitCounter = 0
export function makeUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  const id = overrides.id ?? `u${++unitCounter}`
  const s = overrides.stats ?? stats()
  return {
    id,
    side: 'player',
    x: 0,
    y: 0,
    hp: s.health,
    maxHp: s.health,
    unitLevel: 1,
    initiativeBase: s.initiative,
    stats: s,
    baseStats: s,
    displayName: id,
    iconEmoji: '🙂',
    statusEffects: [],
    cards: [makeBasicCard()],
    hasActedThisRound: false,
    hitsTaken: 0,
    ...overrides,
  }
}

export function makeState(units: BattleUnit[], field?: BattleField): BattleState {
  return {
    field: field ?? makeField(10, 10),
    units,
    round: 0,
    phase: 'ongoing',
    turnOrder: [],
    activeIndex: 0,
    log: [],
    worldPower: 0,
    enemyKills: 0,
  }
}

export function makeContext(
  cards: CardTemplate[] = [STRIKE_CARD],
  mods: ModTemplate[] = [],
  seed = 42,
): BattleContext {
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    mods: new Map(mods.map((m) => [m.id, m])),
    rng: new SeededRng(seed),
  }
}
