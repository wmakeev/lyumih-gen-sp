/**
 * Шаблоны умений (§6.5, §17.1) и их виды.
 */

import type { StatId } from './stats'

/** 11 видов карт (§6.5). */
export type CardKind =
  | 'melee'
  | 'ranged'
  | 'aoe'
  | 'heal'
  | 'regen'
  | 'resurrect'
  | 'buff'
  | 'debuff'
  | 'dot'
  | 'lifesteal_spell'
  | 'utility'

export const CARD_KINDS: readonly CardKind[] = [
  'melee',
  'ranged',
  'aoe',
  'heal',
  'regen',
  'resurrect',
  'buff',
  'debuff',
  'dot',
  'lifesteal_spell',
  'utility',
]

/** Какие виды наносят урон / лечат / накладывают статусы. */
export const DAMAGING_KINDS = new Set<CardKind>([
  'melee',
  'ranged',
  'aoe',
  'dot',
  'lifesteal_spell',
])
export const HEALING_KINDS = new Set<CardKind>(['heal', 'regen', 'lifesteal_spell'])

/** Статус-эффект, накладываемый умением (buff/debuff/dot/regen). */
export interface StatusEffectSpec {
  id: string
  /** Длительность в ходах носителя статуса. */
  duration: number
  /** Модификаторы статов на время действия. */
  statMods?: Partial<Record<StatId, number>>
  /** Урон/лечение за тик (на on_turn_start цели). Отрицательное = урон. */
  tickAmount?: number
  /** Токен %% для масштабирования тика по уровню умения. */
  tickToken?: string
  /** Тег урона тика (для резистов §13.3). */
  damageTag?: string
}

export interface CardTemplate {
  id: string
  label: string
  kind: CardKind
  /** Дальность применения (манхэттен). 1 = соседняя клетка. */
  maxRange: number
  /** Источник стат-бонуса к величине (§6.6). */
  statSource: StatId
  /** Плоская часть величины (§6.6). */
  skillFlat: number
  /** Токен %% масштабирования по L (§6.6). */
  scaleToken: string
  /** Базовый cooldown в ходах (в рантайме ×2, кроме strike — §7.4). */
  cooldownTurns: number
  /** Теги носителя (для фильтра модов и резистов). */
  tags: string[]
  /** Размер AoE (радиус манхэттен) для kind=aoe. */
  aoeRadius?: number
  /** Спецификация статуса для buff/debuff/dot/regen. */
  status?: StatusEffectSpec
  /** Активен ли шаблон (для phase-2 контента). */
  enabled?: boolean
}

/** Канал базовой атаки strike (§6.4): без L и модов, прогресс на оружии. */
export const STRIKE_TEMPLATE_ID = 'strike'
