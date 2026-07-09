/**
 * ИИ (§6.11).
 *  - Враги: выбор умения по skillPriorities, фолбэк на базовую атаку.
 *  - Авто-бой героя: ближайший враг, максимальный урон, greedy move (без A*).
 * Одно основное действие за ход (§6.4): move ЛИБО attack/card ЛИБО end.
 */

import type { BattleState, BattleUnit, BattleCard, Cell } from '../types/battle'
import { manhattan, reachableCells } from './geometry'
import { isAlive, unitById, aliveBySide } from './queue'
import { resolveCardOutcome, NO_CRIT } from './outcome'
import { applyMove, basicAttack, useCard, endTurn, type BattleContext } from './engine'

export type BattleAction =
  | { type: 'move'; cell: Cell }
  | { type: 'basic'; targetId: string }
  | { type: 'card'; instanceId: string; targetId?: string; cell?: Cell }
  | { type: 'end' }

function nearestEnemy(state: BattleState, unit: BattleUnit): BattleUnit | undefined {
  const foes = aliveBySide(state, unit.side === 'player' ? 'enemy' : 'player')
  let best: BattleUnit | undefined
  let bestD = Infinity
  for (const f of foes) {
    const d = manhattan(unit, f)
    if (d < bestD) {
      bestD = d
      best = f
    }
  }
  return best
}

/**
 * Оценка урона карты по цели без крита/проков (для выбора AI). Читает величину
 * из единого резолвера (NO_CRIT не потребляет боевой rng — планирование чистое).
 */
function estimateCardDamage(
  state: BattleState,
  card: BattleCard,
  caster: BattleUnit,
  target: BattleUnit,
  ctx: BattleContext,
): number {
  const outcome = resolveCardOutcome(state, caster, card, { x: target.x, y: target.y }, {
    ...ctx,
    rng: NO_CRIT,
  })
  if (!outcome) return 0
  const ot = outcome.targets.find((t) => t.unitId === target.id)
  if (!ot || ot.kind !== 'damage') return 0
  return ot.hits.reduce((sum, h) => sum + h.amount, 0)
}

function cardCanReach(
  state: BattleState,
  caster: BattleUnit,
  card: BattleCard,
  target: BattleUnit,
  ctx: BattleContext,
): boolean {
  const outcome = resolveCardOutcome(state, caster, card, { x: target.x, y: target.y }, {
    ...ctx,
    rng: NO_CRIT,
  })
  return outcome?.inRange ?? false
}

/** Greedy-шаг к цели: достижимая клетка с минимальным манхэттеном до target. */
function greedyStepToward(
  state: BattleState,
  unit: BattleUnit,
  target: Cell,
): Cell | undefined {
  const blocked = new Set<string>()
  for (const u of state.units) {
    if (u.id !== unit.id && isAlive(u)) blocked.add(`${u.x},${u.y}`)
  }
  const reach = reachableCells(state.field, unit, unit.stats.speed, blocked)
  let best: Cell | undefined
  let bestD = manhattan(unit, target)
  for (const key of reach.keys()) {
    const [x, y] = key.split(',').map(Number)
    const cell = { x: x!, y: y! }
    const d = manhattan(cell, target)
    if (d < bestD) {
      bestD = d
      best = cell
    }
  }
  return best
}

/**
 * Планирует одно действие для юнита. mode='enemy' — по приоритетам;
 * mode='auto' — максимальный урон (только атакующие карты, §6.11 v1).
 */
export function planAction(
  state: BattleState,
  unitId: string,
  ctx: BattleContext,
  mode: 'enemy' | 'auto',
): BattleAction {
  const unit = unitById(state, unitId)
  if (!unit || !isAlive(unit)) return { type: 'end' }
  const target = nearestEnemy(state, unit)
  if (!target) return { type: 'end' }

  const ready = unit.cards.filter((c) => c.cooldownLeft === 0)

  // Кандидаты атакующих карт, достающих цель
  const attackers = ready.filter(
    (c) =>
      !c.isBasic &&
      estimateCardDamage(state, c, unit, target, ctx) > 0 &&
      cardCanReach(state, unit, c, target, ctx),
  )

  if (mode === 'enemy' && unit.skillPriorities && unit.skillPriorities.length > 0) {
    for (const tid of unit.skillPriorities) {
      const c = attackers.find((a) => a.templateId === tid)
      if (c) return { type: 'card', instanceId: c.instanceId, targetId: target.id }
    }
  }

  if (attackers.length > 0) {
    // приоритет добивания, затем максимальный урон
    attackers.sort((a, b) => {
      const da = estimateCardDamage(state, a, unit, target, ctx)
      const db = estimateCardDamage(state, b, unit, target, ctx)
      const killA = da >= target.hp ? 1 : 0
      const killB = db >= target.hp ? 1 : 0
      if (killA !== killB) return killB - killA
      return db - da
    })
    const best = attackers[0]!
    return { type: 'card', instanceId: best.instanceId, targetId: target.id }
  }

  // базовая атака
  const basic = ready.find((c) => c.isBasic)
  if (basic && cardCanReach(state, unit, basic, target, ctx)) {
    return { type: 'basic', targetId: target.id }
  }

  // иначе двигаемся к цели
  const step = greedyStepToward(state, unit, target)
  if (step) return { type: 'move', cell: step }
  return { type: 'end' }
}

/** Выполняет действие и завершает ход юнита. */
export function executeAction(
  state: BattleState,
  unitId: string,
  action: BattleAction,
  ctx: BattleContext,
): void {
  switch (action.type) {
    case 'move':
      applyMove(state, unitId, action.cell)
      break
    case 'basic':
      basicAttack(state, unitId, action.targetId, ctx)
      break
    case 'card':
      useCard(
        state,
        unitId,
        action.instanceId,
        { unitId: action.targetId, cell: action.cell },
        ctx,
      )
      break
    case 'end':
      break
  }
  if (state.phase === 'ongoing') endTurn(state)
}

/** Полный ход ИИ-юнита: план + исполнение. */
export function takeAITurn(
  state: BattleState,
  unitId: string,
  ctx: BattleContext,
  mode: 'enemy' | 'auto' = 'enemy',
): BattleAction {
  const action = planAction(state, unitId, ctx, mode)
  executeAction(state, unitId, action, ctx)
  return action
}
