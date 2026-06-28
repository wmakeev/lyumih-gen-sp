/**
 * Типы системы Memento Mori (§16) — носители прогресса, слоты и моды.
 */

// --- Слоты модификаторов (§16.8) ---

export interface ModOffer {
  /** 3 или 4 (при склонности mod_offer_plus) id модов. Повторения разрешены. */
  modIds: string[]
  /** Seed для детерминированной генерации/реролла. */
  rollSeed: number
}

export type ModSlotState =
  | { status: 'empty'; offer: ModOffer | null }
  | { status: 'filled'; templateId: string; lm: number }

// --- Носители L (§16.5) ---

export interface CardInstance {
  /** Уникальный id экземпляра. */
  id: string
  /** Ссылка на шаблон умения. */
  templateId: string
  /** Уровень носителя L (стартует с 1). */
  global_level: number
  /** Счётчик применений. */
  uses_count: number
  /** Слоты модов. */
  modSlots: ModSlotState[]
}

export interface PassiveInstance {
  id: string
  templateId: string
  /** Уровень носителя L (стартует с 1). */
  global_level: number
  uses_count: number
  modSlots: ModSlotState[]
}

export interface ItemInstance {
  id: string
  templateId: string
  /** Уровень предмета L (стартует с 1; «кулаки» = 0). */
  itemLevel: number
  modSlots: ModSlotState[]
}

// --- Моды (§16.11, §16.13) ---

export type ModGroup = 'damage' | 'survival' | 'utility' | 'defense'

export type ModOp =
  | { kind: 'damage_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'heal_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'range_add'; base: number; scaleMode: 'flat' }
  | { kind: 'cooldown_add'; base: number; scaleMode: 'flat' }
  | { kind: 'aoe_size_add'; base: number; scaleMode: 'flat' }
  | { kind: 'crit_chance_add'; base: number; scaleMode: 'percent' }
  | { kind: 'carrier_hp_add'; base: number; scaleMode: 'flat' }
  | { kind: 'defense_add'; base: number; scaleMode: 'flat' }
  | { kind: 'initiative_add'; base: number; scaleMode: 'flat' }
  | { kind: 'self_heal_on_use'; base: number; scaleMode: 'percent' }
  | { kind: 'lifesteal_pct'; base: number; scaleMode: 'percent' }
  | { kind: 'proc_extra_hit'; baseChance: number; hits: number }
  | { kind: 'reflect_on_hit'; base: number; scaleMode: 'percent' }
  | { kind: 'self_heal_on_damaged'; base: number; scaleMode: 'percent' }
  | { kind: 'aoe_center_damage_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'heal_splash'; splashRatio: number; scaleMode: 'percent' }

export type ModOpKind = ModOp['kind']

/** Тег носителя (§16.13). */
export type CarrierTag =
  | 'melee'
  | 'ranged'
  | 'aoe'
  | 'heal'
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'attack'
  | 'skill'
  | 'passive'

export interface ModTemplate {
  id: string
  label: string
  group: ModGroup
  /** carrierTags ⊇ requires (§16.13). */
  requires: string[]
  /** carrierTags ∩ excludes = ∅; также конфликт с занятыми слотами. */
  excludes?: string[]
  descriptionLines: string[]
  ops: ModOp[]
  /** Активен ли мод (phase-2 моды disabled). */
  enabled?: boolean
}

/** Тип носителя для выбора пула модов (§16.14). */
export type CarrierKind = 'card' | 'item' | 'passive'
