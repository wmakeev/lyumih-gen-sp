/**
 * Создание персонажей: найм кандидата, стартовый герой (§10).
 */

import type { Rng } from '../rng'
import type { Character, CharacterEquipment } from '../types/character'
import type { ContentRegistry } from '../types/content'
import type { TavernCandidate } from '../types/campaign'
import type { StatBlock } from '../types/stats'
import { nextId } from './ids'
import { createCardInstance, createItemInstance } from './instances'

const ICON_EMOJIS = ['🧙', '🛡️', '🏹', '⚔️', '🗡️', '🪄', '🔮', '🐺']
const ACCENTS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085']
const SKIN_TONES = ['🏻', '🏼', '🏽', '🏾', '🏿']

const HERO_NAMES = [
  'Эйрик', 'Лира', 'Гром', 'Сильвана', 'Кейн', 'Мира', 'Тор', 'Ная',
  'Борис', 'Эльза', 'Дрейк', 'Фрея', 'Игнат', 'Луна', 'Орин', 'Вера',
]

export function randomName(rng: Rng): string {
  return rng.pick(HERO_NAMES)
}

export interface CreateCharacterParams {
  classId: string
  name: string
  baseStats: StatBlock
  baseStatRating: number
  specializationId: string
  startingGear: string[]
  startingCardTemplateId: string
  registry: ContentRegistry
  iconEmoji?: string
  iconAccent?: string
  iconSkinTone?: string
  rng: Rng
}

export function createCharacter(p: CreateCharacterParams): Character {
  const id = nextId('hero')

  // экипировка из стартового снаряжения
  const items = p.startingGear.map((tid) => createItemInstance(tid))
  const equipment: CharacterEquipment = { weapon: null, armor: null, accessory: null }
  for (const item of items) {
    const tpl = p.registry.items.get(item.templateId)
    if (tpl) equipment[tpl.slot] = item.id
  }

  const startCard = createCardInstance(p.startingCardTemplateId)

  return {
    id,
    name: p.name,
    classId: p.classId,
    unitLevel: 1,
    baseStats: p.baseStats,
    baseStatRating: p.baseStatRating,
    specializationId: p.specializationId,
    equipment,
    items,
    cards: [startCard],
    passives: [],
    battleLoadout: [startCard.id],
    passiveEquip: [],
    iconEmoji: p.iconEmoji ?? p.rng.pick(ICON_EMOJIS),
    iconAccent: p.iconAccent ?? p.rng.pick(ACCENTS),
    iconSkinTone: p.iconSkinTone ?? p.rng.pick(SKIN_TONES),
  }
}

/** Найм кандидата таверны (§10): статы фиксируются, склонность раскрывается. */
export function hireCandidate(
  candidate: TavernCandidate,
  registry: ContentRegistry,
  rng: Rng,
): Character {
  return createCharacter({
    classId: candidate.classId,
    name: candidate.name,
    baseStats: candidate.baseStats,
    baseStatRating: candidate.baseStatRating,
    specializationId: candidate.hiddenSpecializationId,
    startingGear: candidate.startingGear,
    startingCardTemplateId: candidate.startingCardTemplateId,
    registry,
    iconEmoji: candidate.iconEmoji,
    iconAccent: candidate.iconAccent,
    iconSkinTone: candidate.iconSkinTone,
    rng,
  })
}

/**
 * Стартовый герой кампании (§10): фиксированный warrior с предустановленными
 * статами (не roll). Склонность — фиксированная lucky_unit.
 */
export function createStartingHero(registry: ContentRegistry, rng: Rng): Character {
  const warrior = registry.classes.get('warrior')
  const fixedStats: StatBlock = {
    health: 45,
    defense: 6,
    attack: 10,
    magicPower: 2,
    mana: 8,
    healPower: 1,
    speed: 3,
    initiative: 12,
    critChance: 5,
  }
  const startCardId = warrior
    ? pickFirstNonStrike(registry, warrior.id)
    : 'strike'
  return createCharacter({
    classId: 'warrior',
    name: 'Командир',
    baseStats: fixedStats,
    baseStatRating: 0.75,
    specializationId: registry.specializations.has('lucky_unit')
      ? 'lucky_unit'
      : firstSpecId(registry),
    startingGear: warrior?.startingGear ?? [],
    startingCardTemplateId: startCardId,
    registry,
    iconEmoji: '🛡️',
    rng,
  })
}

function firstSpecId(registry: ContentRegistry): string {
  const first = registry.specializations.keys().next().value
  return first ?? 'lucky_unit'
}

/** Первое небазовое умение в реестре (для стартовой карты). */
function pickFirstNonStrike(registry: ContentRegistry, _classId: string): string {
  for (const [id, tpl] of registry.cards) {
    if (id !== 'strike' && tpl.enabled !== false) return id
  }
  return 'strike'
}
