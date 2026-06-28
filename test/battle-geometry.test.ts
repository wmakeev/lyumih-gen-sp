import { describe, it, expect } from 'vitest'
import {
  manhattan,
  hasLineOfSight,
  reachableCells,
  isWall,
} from '../src/core/battle/geometry'
import { makeField } from './helpers/battle-fixtures'

describe('manhattan (§6.1)', () => {
  it('сумма модулей разностей', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
    expect(manhattan({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0)
  })
})

describe('line of sight (§6.1)', () => {
  it('чистая линия → есть LoS', () => {
    const f = makeField(5, 5)
    expect(hasLineOfSight(f, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })
  it('стена на пути → нет LoS', () => {
    const f = makeField(5, 1, [[2, 0]])
    expect(isWall(f, 2, 0)).toBe(true)
    expect(hasLineOfSight(f, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false)
  })
})

describe('reachableCells BFS (§6.4)', () => {
  it('за speed=1 — 4 соседа на открытом поле', () => {
    const f = makeField(5, 5)
    const r = reachableCells(f, { x: 2, y: 2 }, 1, new Set())
    expect(r.size).toBe(4)
  })
  it('стены и занятые клетки блокируют', () => {
    const f = makeField(3, 1, [[1, 0]])
    const r = reachableCells(f, { x: 0, y: 0 }, 5, new Set())
    // стена в (1,0) отрезает (2,0)
    expect(r.has('2,0')).toBe(false)
    expect(r.has('1,0')).toBe(false)
  })
  it('стоимость пути = число шагов', () => {
    const f = makeField(5, 5)
    const r = reachableCells(f, { x: 0, y: 0 }, 3, new Set())
    expect(r.get('1,0')).toBe(1)
    expect(r.get('3,0')).toBe(3)
    expect(r.has('4,0')).toBe(false)
  })
})
