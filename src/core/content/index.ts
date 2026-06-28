/**
 * Сборка реестра статического контента (§14, §17) + программный кодекс.
 */

import type {
  ContentRegistry,
  CodexEntry,
  RaceDef,
  ItemTemplate,
  EnemyArchetype,
  PassiveTemplate,
} from '../types/content'
import type { ClassDef } from '../types/character'
import type { CardTemplate } from '../types/cards'
import type { ModTemplate } from '../types/memento'

import { CLASSES } from './classes'
import { SPECIALIZATIONS } from './specializations'
import { ALL_CARDS } from './cards'
import { ALL_PASSIVES } from './passives'
import { ITEMS } from './items'
import { RACES } from './races'
import { ENEMY_ARCHETYPES } from './enemies'
import { CARD_ITEM_MODS, PASSIVE_MODS } from './mods'
import { SCENARIOS } from './scenarios'
import { EXPEDITIONS } from './expeditions'

export * from './classes'
export * from './specializations'
export * from './cards'
export * from './passives'
export * from './items'
export * from './races'
export * from './enemies'
export * from './mods'
export * from './scenarios'
export * from './expeditions'

function toMap<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const it of items) m.set(it.id, it)
  return m
}

// --- Программная генерация кодекса (§14.1) ---

function classCodex(c: ClassDef): CodexEntry {
  return {
    id: `class_${c.id}`,
    category: 'class',
    title: c.label,
    lines: [
      `Класс героя. Базовая атака: ${c.baseAttack}.`,
      `Главные статы: ${c.primaryStats.join(', ')}.`,
      `Второстепенные статы: ${c.secondaryStats.join(', ')}.`,
    ],
  }
}

function raceCodex(r: RaceDef): CodexEntry {
  const affLines = Object.entries(r.affinities).map(
    ([tag, mult]) => `${tag}: ×${mult}`,
  )
  return {
    id: `affinity_${r.id}`,
    category: 'affinity',
    title: `Раса: ${r.label}`,
    lines: ['Элементальные склонности (множитель урона):', ...affLines],
  }
}

function itemCodex(i: ItemTemplate): CodexEntry {
  return {
    id: `item_${i.id}`,
    category: 'item',
    title: i.label,
    lines: [
      `Слот: ${i.slot}. Цена в лавке: ${i.shopPrice} золота.`,
      `Прибавки за уровень предмета: HP +${i.hpBonusPerItemLevel}, уровень урона карт +${i.cardLevelBonusPerItemLevel}.`,
    ],
  }
}

function cardCodex(c: CardTemplate): CodexEntry {
  return {
    id: `card_${c.id}`,
    category: 'card',
    title: c.label,
    lines: [
      `Тип умения: ${c.kind}. Дальность: ${c.maxRange}.`,
      `Источник величины: ${c.statSource}; база ${c.skillFlat}, масштаб ${c.scaleToken}; перезарядка ${c.cooldownTurns} ходов.`,
    ],
  }
}

function passiveCodex(p: PassiveTemplate): CodexEntry {
  return {
    id: `passive_${p.id}`,
    category: 'passive',
    title: p.label,
    lines: [
      p.description,
      `Триггер: ${p.trigger}; шанс срабатывания ${Math.round(p.procChance * 100)}%.`,
    ],
  }
}

function enemyCodex(e: EnemyArchetype): CodexEntry {
  const role = e.isBoss ? 'Босс' : e.isChaotic ? 'Хаотичный враг' : 'Враг'
  return {
    id: `enemy_${e.id}`,
    category: 'enemy',
    title: e.label,
    lines: [
      `${role}. Раса: ${e.raceId}. Базовая атака: ${e.baseAttack}.`,
      `Угрозы: ${e.threatTags.join(', ')}.`,
    ],
  }
}

function modCodex(m: ModTemplate): CodexEntry {
  return {
    id: `mod_${m.id}`,
    category: 'mod',
    title: m.label,
    lines: [...m.descriptionLines, `Группа: ${m.group}; требует: ${m.requires.join(', ') || '—'}.`],
  }
}

export function buildCodex(): CodexEntry[] {
  const entries: CodexEntry[] = []
  for (const c of CLASSES) entries.push(classCodex(c))
  for (const r of RACES) entries.push(raceCodex(r))
  for (const i of ITEMS) entries.push(itemCodex(i))
  for (const c of ALL_CARDS) entries.push(cardCodex(c))
  for (const p of ALL_PASSIVES) entries.push(passiveCodex(p))
  for (const e of ENEMY_ARCHETYPES) entries.push(enemyCodex(e))
  for (const m of [...CARD_ITEM_MODS, ...PASSIVE_MODS]) entries.push(modCodex(m))
  return entries
}

export function buildContentRegistry(): ContentRegistry {
  return {
    classes: toMap(CLASSES),
    specializations: toMap(SPECIALIZATIONS),
    cards: toMap(ALL_CARDS),
    passives: toMap(ALL_PASSIVES),
    items: toMap(ITEMS),
    races: toMap(RACES),
    enemies: toMap(ENEMY_ARCHETYPES),
    cardItemMods: toMap(CARD_ITEM_MODS),
    passiveMods: toMap(PASSIVE_MODS),
    scenarios: toMap(SCENARIOS),
    expeditions: toMap(EXPEDITIONS),
    codex: toMap(buildCodex()),
  }
}

/** Готовый синглтон-реестр для удобства (§14). */
export const CONTENT: ContentRegistry = buildContentRegistry()
