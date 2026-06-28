/**
 * Состояние кампании (§4.1) и связанные типы (§8.5, §9, §10, §12).
 */

import type { Character } from './character'
import type { CardInstance, ItemInstance, PassiveInstance } from './memento'
import type { BattleState } from './battle'

export type RunPhase = 'hub' | 'battle' | 'victory' | 'defeat' | 'inter_battle'

export interface CampaignChest {
  items: ItemInstance[]
  unboundCards: CardInstance[]
  unboundPassives: PassiveInstance[]
}

export interface ShopOffer {
  items: { instance: ItemInstance; price: number }[]
  card: { instance: CardInstance; price: number } | null
  passive: { instance: PassiveInstance; price: number } | null
}

export interface TavernCandidate {
  id: string
  classId: string
  baseStats: import('./stats').StatBlock
  baseStatRating: number
  price: number
  /** Стартовая экипировка-превью (templateId). */
  startingGear: string[]
  name: string
  iconEmoji: string
  iconAccent: string
  iconSkinTone: string
  /** Склонность скрыта до найма (§10) — хранится, но не показывается. */
  hiddenSpecializationId: string
  /** Случайное стартовое умение (кроме strike). */
  startingCardTemplateId: string
}

export type MetaStatus = 'available' | 'downed'

export interface ExpeditionSquadMember {
  characterId: string
  metaStatus: MetaStatus
}

export interface Expedition {
  scenarioChainId: string
  generationSeed: number
  partySize: number
  squadSnapshot: ExpeditionSquadMember[]
  battleIndex: number
  battleCount: number
  shopLocked: true
  interBattleReviveAllDowned?: boolean
}

export interface BattleAttemptSnapshot {
  gold: number
  worldPower: number
  scenarioSlotIndex: number
  /** Снимок персонажей-участников (deep copy для анти-дюпа наград §15). */
  characters: Character[]
  chest: CampaignChest
}

export interface PendingHubNotice {
  kind: 'drop' | 'specialization_reveal' | 'dual_drop' | 'info'
  text: string
}

export interface CampaignState {
  /** Версия схемы для миграций (§15). */
  version: number
  scenarioIndex: number
  worldPower: number
  gold: number
  phase: RunPhase
  characters: Character[]
  /** 4 слота отряда в хабе. */
  squad: (string | null)[]
  expedition: Expedition | null
  chest: CampaignChest
  shopOffers: ShopOffer | null
  tavernCandidates: TavernCandidate[]
  codexDiscovered: string[]
  battle: BattleState | null
  battleAttemptSnapshot: BattleAttemptSnapshot | null
  battleAttemptId: number
  pendingHubNotice: PendingHubNotice | null
}
