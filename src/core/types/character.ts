/**
 * Персонажи, классы, склонности, экипировка (§4.2, §5.3, §11).
 */

import type { StatBlock, StatId } from './stats'
import type { CardInstance, ItemInstance, PassiveInstance } from './memento'

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory'

export interface ClassDef {
  id: string
  label: string
  /** Primary-статы: +50% верхней границы roll (§5.3). */
  primaryStats: StatId[]
  /** Secondary-статы: +25% (§5.3). */
  secondaryStats: StatId[]
  /** Базовая атака класса. */
  baseAttack: 'strike' | 'shot' | 'magic_bolt'
  /** id стартовых предметов класса (3: weapon/armor/accessory). */
  startingGear: [string, string, string]
  iconEmoji: string
}

/** Категория склонности (§11.1). */
export type SpecializationKind = 'lucky' | 'meta' | 'slot' | 'mod'

export interface SpecializationDef {
  id: string
  label: string
  kind: SpecializationKind
  description: string
  /** Машинно-читаемый эффект (интерпретируется ядром). */
  effect: SpecializationEffect
}

export type SpecializationEffect =
  | { type: 'lucky'; target: 'card' | 'item' | 'passive' | 'unit' }
  | { type: 'meta_drop'; what: 'skill' | 'passive'; bonus: number }
  | { type: 'meta_gold'; bonus: number }
  | { type: 'slot_skill_plus'; amount: number }
  | { type: 'slot_passive_plus'; amount: number }
  | { type: 'mod_offer_plus' }
  | { type: 'mod_soft_rollback' }
  | { type: 'meta_stat'; stat: StatId; bonus: number }

export interface CharacterEquipment {
  weapon: string | null // itemInstance id
  armor: string | null
  accessory: string | null
}

export interface Character {
  id: string
  name: string
  classId: string
  /** Уровень персонажа (Memento §16.6–16.7). */
  unitLevel: number
  /** 9 базовых статов, зафиксированы при найме (§5.3). */
  baseStats: StatBlock
  /** Среднее качество roll, 0..1+ (§4.2). */
  baseStatRating: number
  /** Склонность (неизменна, §11). */
  specializationId: string
  equipment: CharacterEquipment
  items: ItemInstance[]
  cards: CardInstance[]
  passives: PassiveInstance[]
  /** До 3 (+бонус) активных умений в бою: id инстансов карт. */
  battleLoadout: string[]
  /** До 4 (+бонус) надетых пассивов: id инстансов. */
  passiveEquip: string[]
  iconEmoji: string
  iconAccent: string
  iconSkinTone: string
}
