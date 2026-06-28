/**
 * Процедурные генераторы боёв (§12.4). Каждый строит эфемерный сценарий
 * (поле, зона спавна героев, слоты врагов) детерминированно по seed.
 */

import { SeededRng, type Rng } from '../rng'
import type { ContentRegistry, StaticScenario, EnemyArchetype } from '../types/content'

function pickWeighted(arch: EnemyArchetype[], rng: Rng): EnemyArchetype {
  if (arch.length === 0)
    throw new Error('pickWeighted: пустой пул архетипов (нет normalEnemies для генератора)')
  const total = arch.reduce((s, a) => s + Math.max(1, a.spawnWeight), 0)
  let r = rng.nextFloat() * total
  for (const a of arch) {
    r -= Math.max(1, a.spawnWeight)
    if (r <= 0) return a
  }
  return arch[arch.length - 1]!
}

function freeCells(
  width: number,
  height: number,
  taken: Set<string>,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!taken.has(`${x},${y}`)) out.push({ x, y })
    }
  return out
}

function normalEnemies(registry: ContentRegistry): EnemyArchetype[] {
  return [...registry.enemies.values()].filter((a) => !a.isBoss)
}
function bosses(registry: ContentRegistry): EnemyArchetype[] {
  return [...registry.enemies.values()].filter((a) => a.isBoss)
}

interface GenParams {
  label: string
  build(registry: ContentRegistry, rng: Rng): StaticScenario
}

function makeScenario(
  id: string,
  label: string,
  width: number,
  height: number,
  heroCells: { x: number; y: number }[],
  enemyDefs: { archetypeId: string; x: number; y: number }[],
  gold: number,
): StaticScenario {
  return {
    id,
    label,
    field: { width, height, walls: [] },
    heroSpawn: { cells: heroCells },
    enemySlots: enemyDefs,
    goldReward: gold,
  }
}

const GENERATORS: Record<string, GenParams> = {
  'chaotic-map': {
    label: 'Хаотичная карта',
    build(registry, rng) {
      const w = rng.int(2, 20)
      const h = rng.int(1, 20)
      const count = Math.min(rng.int(1, 20), w * h - 1)
      const pool = normalEnemies(registry)
      const taken = new Set<string>()
      // герои в левом столбце
      const heroCells = freeCells(1, Math.min(4, h), taken).map((c) => {
        taken.add(`${c.x},${c.y}`)
        return c
      })
      const enemies: { archetypeId: string; x: number; y: number }[] = []
      const cells = rng.shuffle(freeCells(w, h, taken))
      for (let i = 0; i < count && i < cells.length; i++) {
        const c = cells[i]!
        enemies.push({ archetypeId: pickWeighted(pool, rng).id, x: c.x, y: c.y })
      }
      return makeScenario('proc-chaotic', 'Хаотичная карта', w, h, heroCells, enemies, 80)
    },
  },
  tunnel: {
    label: 'Туннель',
    build(registry, rng) {
      const pool = normalEnemies(registry)
      const heroCells = [{ x: 0, y: 0 }]
      const enemies = [
        { archetypeId: pickWeighted(pool, rng).id, x: 5, y: 0 },
        { archetypeId: pickWeighted(pool, rng).id, x: 9, y: 0 },
      ]
      return makeScenario('proc-tunnel', 'Туннель', 10, 1, heroCells, enemies, 90)
    },
  },
  'big-arena': {
    label: 'Большая арена',
    build(registry, rng) {
      const pool = normalEnemies(registry)
      const bossPool = bosses(registry)
      const count = rng.int(8, 12)
      const bossCount = rng.int(1, 3)
      const taken = new Set<string>()
      const heroCells = freeCells(1, 4, taken).map((c) => {
        taken.add(`${c.x},${c.y}`)
        return c
      })
      const cells = rng.shuffle(freeCells(10, 20, taken))
      const enemies: { archetypeId: string; x: number; y: number }[] = []
      let ci = 0
      for (let i = 0; i < count && ci < cells.length; i++, ci++) {
        const c = cells[ci]!
        enemies.push({ archetypeId: pickWeighted(pool, rng).id, x: c.x, y: c.y })
      }
      for (let i = 0; i < bossCount && ci < cells.length && bossPool.length > 0; i++, ci++) {
        const c = cells[ci]!
        enemies.push({ archetypeId: rng.pick(bossPool).id, x: c.x, y: c.y })
      }
      return makeScenario('proc-arena', 'Большая арена', 10, 20, heroCells, enemies, 200)
    },
  },
  'small-skirmish': {
    label: 'Малая стычка',
    build(registry, rng) {
      const pool = normalEnemies(registry)
      return makeScenario(
        'proc-skirmish',
        'Малая стычка',
        2,
        1,
        [{ x: 0, y: 0 }],
        [{ archetypeId: pickWeighted(pool, rng).id, x: 1, y: 0 }],
        50,
      )
    },
  },
  ambush: {
    label: 'Засада',
    build(registry, rng) {
      const pool = normalEnemies(registry)
      const heroCells = [
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 4, y: 5 },
        { x: 5, y: 5 },
      ]
      const perimeter: { x: number; y: number }[] = []
      for (let x = 0; x < 10; x++) {
        perimeter.push({ x, y: 0 }, { x, y: 9 })
      }
      const shuffled = rng.shuffle(perimeter)
      const enemies = shuffled
        .slice(0, 8)
        .map((c) => ({ archetypeId: pickWeighted(pool, rng).id, x: c.x, y: c.y }))
      return makeScenario('proc-ambush', 'Засада', 10, 10, heroCells, enemies, 150)
    },
  },
}

/** Строит сценарий для процедурного режима по seed (детерминизм §12.1). */
export function buildProceduralScenario(
  generatorId: string,
  seed: number,
  battleIndex: number,
  registry: ContentRegistry,
): StaticScenario | null {
  const gen = GENERATORS[generatorId]
  if (!gen) return null
  // разный seed на каждый бой цепочки
  const rng: Rng = new SeededRng(seed + battleIndex * 7919)
  return gen.build(registry, rng)
}

export const PROCEDURAL_GENERATOR_IDS = Object.keys(GENERATORS)
