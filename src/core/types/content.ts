/**
 * Типы статического контента (§8, §12, §13) и реестры.
 */

import type { StatBlock } from './stats'
import type { EquipmentSlot } from './character'
import type { CardTemplate } from './cards'
import type { ModTemplate } from './memento'
import type { ClassDef, SpecializationDef } from './character'

export interface ItemTemplate {
  id: string
  label: string
  slot: EquipmentSlot
  shopPrice: number
  /** Бонус maxHp за уровень предмета (§8.2). */
  hpBonusPerItemLevel: number
  /** Бонус к уровню расчёта урона карт за уровень предмета (§8.2, §6.6). */
  cardLevelBonusPerItemLevel: number
  /** Прочие стат-бонусы за уровень предмета. */
  statBonusPerItemLevel?: Partial<StatBlock>
  /** Теги для фильтра модов. */
  tags: string[]
  iconEmoji: string
}

export interface RaceDef {
  id: string
  label: string
  /** Резисты/уязвимости: множитель урона по тегу (1 = нейтрально). */
  affinities: Record<string, number>
  iconEmoji: string
}

export interface SkillPreset {
  templateId: string
  level: number
  /** Пресет модов: templateId по слотам. */
  modSlots: { templateId: string; lm: number }[]
}

export interface EnemyArchetype {
  id: string
  label: string
  raceId: string
  classId?: string
  /** Контрит стиль класса в смешанном отряде (§13.1). */
  counterClass?: string
  baseStats: StatBlock
  baseAttack: 'strike' | 'shot' | 'magic_bolt'
  skillPresets: SkillPreset[]
  passivePresets: { templateId: string; level: number }[]
  /** Приоритеты умений для AI (templateId по убыванию). */
  skillPriorities: string[]
  threatTags: string[]
  spawnWeight: number
  isBoss?: boolean
  isChaotic?: boolean
  /** Спец-механики боссов (§13.4). */
  bossMechanics?: string[]
  iconEmoji: string
}

// --- Сценарии и экспедиции (§12) ---

export interface SpawnZone {
  cells: { x: number; y: number }[]
}

export interface StaticScenario {
  id: string
  label: string
  field: { width: number; height: number; walls: [number, number][] }
  heroSpawn: SpawnZone
  /** Слоты врагов: archetypeId по позициям. Каждый 4-й — босс (§12.6). */
  enemySlots: { archetypeId: string; x: number; y: number }[]
  goldReward: number
}

export type ExpeditionKind = 'static' | 'procedural'

export interface ExpeditionModeDef {
  id: string
  label: string
  kind: ExpeditionKind
  battleCountRange: [number, number]
  partyMin: number
  partyMax: number
  /** Revive между боями разрешён (§12.3). */
  interBattleReviveAllDowned: boolean
  /** Для static — список сценариев цепочки. */
  scenarioChain?: string[]
  /** Для procedural — id генератора. */
  generatorId?: string
  description: string
}

// --- Кодекс (§14.1) ---

export type CodexCategory =
  | 'class'
  | 'affinity'
  | 'item'
  | 'card'
  | 'passive'
  | 'enemy'
  | 'mod'

export interface CodexEntry {
  id: string
  category: CodexCategory
  title: string
  lines: string[]
}

// --- Реестры контента ---

export interface ContentRegistry {
  classes: Map<string, ClassDef>
  specializations: Map<string, SpecializationDef>
  cards: Map<string, CardTemplate>
  passives: Map<string, PassiveTemplate>
  items: Map<string, ItemTemplate>
  races: Map<string, RaceDef>
  enemies: Map<string, EnemyArchetype>
  /** Пул модов карт/предметов (§16.14). */
  cardItemMods: Map<string, ModTemplate>
  /** Пул модов пассивов (§16.14). */
  passiveMods: Map<string, ModTemplate>
  scenarios: Map<string, StaticScenario>
  expeditions: Map<string, ExpeditionModeDef>
  codex: Map<string, CodexEntry>
}

/** Триггеры пассивов (§7.3). */
export type PassiveTrigger =
  | 'on_strike'
  | 'on_card_use'
  | 'on_heal'
  | 'on_damaged'
  | 'on_turn_start'
  | 'on_kill'
  | 'on_battle_start'

export interface PassiveTemplate {
  id: string
  label: string
  trigger: PassiveTrigger
  /** Шанс срабатывания (0..1). proc-успех двигает L (§7.2). */
  procChance: number
  description: string
  /** Эффект пассива (стат-бонусы / лечение / урон), интерпретируется ядром. */
  effect: PassiveEffect
  tags: string[]
  /** Для врагов. */
  isEnemy?: boolean
}

export type PassiveEffect =
  | { type: 'stat'; mods: Partial<StatBlock> }
  | { type: 'heal_on_trigger'; token: string }
  | { type: 'damage_on_trigger'; token: string }
  | { type: 'shield_on_trigger'; token: string }
