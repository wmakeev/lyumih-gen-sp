/**
 * Геометрия боевого поля (§6.1): манхэттен, LoS, BFS-достижимость.
 * 4 ортогональных направления, без диагоналей.
 */

import type { BattleField, Cell } from '../types/battle'

export function inBounds(field: BattleField, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < field.width && y < field.height
}

export function cellIndex(field: BattleField, x: number, y: number): number {
  return y * field.width + x
}

export function isWall(field: BattleField, x: number, y: number): boolean {
  if (!inBounds(field, x, y)) return true
  return field.terrain[cellIndex(field, x, y)] === 'wall'
}

/** Манхэттенское расстояние (§6.1). */
export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/**
 * Достижимые клетки за `speed` шагов (BFS, §6.4). Препятствия: стены и занятые
 * клетки (из `blocked`). Возвращает Map "x,y" → стоимость пути (шагов).
 * Стартовая клетка не включается.
 */
export function reachableCells(
  field: BattleField,
  start: Cell,
  speed: number,
  blocked: ReadonlySet<string>,
): Map<string, number> {
  const result = new Map<string, number>()
  if (speed <= 0) return result
  const startKey = `${start.x},${start.y}`
  const dist = new Map<string, number>([[startKey, 0]])
  let frontier: Cell[] = [start]
  let step = 0
  while (frontier.length > 0 && step < speed) {
    step++
    const next: Cell[] = []
    for (const c of frontier) {
      for (const [dx, dy] of DIRS) {
        const nx = c.x + dx
        const ny = c.y + dy
        const key = `${nx},${ny}`
        if (dist.has(key)) continue
        if (isWall(field, nx, ny)) continue
        if (blocked.has(key)) continue
        dist.set(key, step)
        result.set(key, step)
        next.push({ x: nx, y: ny })
      }
    }
    frontier = next
  }
  return result
}

/**
 * Line of sight (§6.1): нет стен на линии между a и b. Используем
 * супер-покрытие (все клетки, которые пересекает отрезок), исключая концы.
 * Юниты LoS не блокируют — только стены.
 */
export function hasLineOfSight(field: BattleField, a: Cell, b: Cell): boolean {
  let x0 = a.x
  let y0 = a.y
  const x1 = b.x
  const y1 = b.y
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  // Идём от a к b; концевые клетки не проверяем на стену.
  for (;;) {
    const atStart = x0 === a.x && y0 === a.y
    const atEnd = x0 === x1 && y0 === y1
    if (!atStart && !atEnd) {
      if (isWall(field, x0, y0)) return false
    }
    if (atEnd) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
  return true
}

/** Соседние проходимые непустые направления (для AI/перемещения). */
export function orthogonalNeighbors(field: BattleField, c: Cell): Cell[] {
  const out: Cell[] = []
  for (const [dx, dy] of DIRS) {
    const nx = c.x + dx
    const ny = c.y + dy
    if (inBounds(field, nx, ny) && !isWall(field, nx, ny)) {
      out.push({ x: nx, y: ny })
    }
  }
  return out
}
