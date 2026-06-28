/**
 * Сборка BattleState из сценария: спавн героев (§6.10, детерминированный
 * shuffle, excluded при нехватке клеток) и врагов.
 */

import type { Rng } from '../rng'
import type { Character } from '../types/character'
import type { ContentRegistry, StaticScenario } from '../types/content'
import type { BattleField, BattleState, BattleUnit, Terrain } from '../types/battle'
import { spawnHeroUnit, spawnEnemyUnit } from './spawn'

function buildField(scenario: StaticScenario): BattleField {
  const { width, height, walls } = scenario.field
  const terrain: Terrain[] = new Array(width * height).fill('floor')
  for (const [x, y] of walls) {
    if (x >= 0 && y >= 0 && x < width && y < height) terrain[y * width + x] = 'wall'
  }
  return { width, height, terrain }
}

export interface BuiltBattle {
  battle: BattleState
  excludedCharacterIds: string[]
}

export function buildBattleFromScenario(
  scenario: StaticScenario,
  squad: Character[],
  registry: ContentRegistry,
  worldPower: number,
  rng: Rng,
  scenarioSlotIndex = 0,
): BuiltBattle {
  const field = buildField(scenario)
  const units: BattleUnit[] = []

  // герои: детерминированный shuffle клеток зоны спавна
  const cells = rng.shuffle(scenario.heroSpawn.cells)
  const excluded: string[] = []
  squad.forEach((ch, i) => {
    const cell = cells[i]
    if (!cell) {
      excluded.push(ch.id)
      return
    }
    units.push(spawnHeroUnit(ch, registry, worldPower, cell.x, cell.y))
  })

  // враги: фиксированные позиции сценария
  scenario.enemySlots.forEach((slot, i) => {
    const arch = registry.enemies.get(slot.archetypeId)
    if (!arch) return
    units.push(spawnEnemyUnit(arch, registry, worldPower, slot.x, slot.y, rng, i))
  })

  const battle: BattleState = {
    field,
    units,
    round: 0,
    phase: 'ongoing',
    turnOrder: [],
    activeIndex: 0,
    log: [],
    worldPower,
    enemyKills: 0,
    scenarioSlotIndex,
  }
  return { battle, excludedCharacterIds: excluded }
}
