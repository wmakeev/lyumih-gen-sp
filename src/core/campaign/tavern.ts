/**
 * Таверна (§10): генерация кандидатов, найм, обновление.
 * Склонность скрыта до найма; статы фиксируются при найме.
 */

import type { Rng } from '../rng'
import type { GameConfig } from '../config'
import type { CampaignState, TavernCandidate } from '../types/campaign'
import type { ContentRegistry } from '../types/content'
import { rollCandidateStats } from './rolls'
import { hireCandidate, randomName } from './factory'
import { nextId } from './ids'
import { LIMITS } from '../config'

const ICON_EMOJIS = ['🧙', '🛡️', '🏹', '⚔️', '🗡️', '🪄', '🔮', '🐺']
const ACCENTS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085']
const SKIN_TONES = ['🏻', '🏼', '🏽', '🏾', '🏿']

const CANDIDATE_BASE_PRICE = 150

export function generateCandidate(
  registry: ContentRegistry,
  rng: Rng,
): TavernCandidate {
  const classes = [...registry.classes.values()]
  const cls = rng.pick(classes)
  const { stats, rating } = rollCandidateStats(cls, rng)

  const specs = [...registry.specializations.keys()]
  const hiddenSpec = rng.pick(specs)

  const nonStrike = [...registry.cards.values()].filter(
    (c) => c.id !== 'strike' && c.enabled !== false,
  )
  const startingCard = nonStrike.length > 0 ? rng.pick(nonStrike).id : 'strike'

  return {
    id: nextId('cand'),
    classId: cls.id,
    baseStats: stats,
    baseStatRating: rating,
    price: Math.round(CANDIDATE_BASE_PRICE * (0.6 + rating)),
    startingGear: [...cls.startingGear],
    name: randomName(rng),
    iconEmoji: rng.pick(ICON_EMOJIS),
    iconAccent: rng.pick(ACCENTS),
    iconSkinTone: rng.pick(SKIN_TONES),
    hiddenSpecializationId: hiddenSpec,
    startingCardTemplateId: startingCard,
  }
}

export function generateTavern(
  registry: ContentRegistry,
  rng: Rng,
  count: number,
): TavernCandidate[] {
  return Array.from({ length: count }, () => generateCandidate(registry, rng))
}

/** Найм кандидата (§10): создаёт персонажа, списывает золото. */
export function hireFromTavern(
  c: CampaignState,
  candidateId: string,
  registry: ContentRegistry,
  rng: Rng,
): { ok: boolean; reason?: string } {
  if (c.characters.length >= LIMITS.maxRoster) return { ok: false, reason: 'roster полон' }
  const idx = c.tavernCandidates.findIndex((x) => x.id === candidateId)
  if (idx < 0) return { ok: false, reason: 'нет кандидата' }
  const cand = c.tavernCandidates[idx]!
  if (c.gold < cand.price) return { ok: false, reason: 'мало золота' }
  c.gold -= cand.price
  const hero = hireCandidate(cand, registry, rng)
  c.characters.push(hero)
  c.tavernCandidates.splice(idx, 1)
  return { ok: true }
}

export function refreshTavern(
  c: CampaignState,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
  count: number,
): boolean {
  if (c.gold < config.shop.refreshCost) return false
  c.gold -= config.shop.refreshCost
  c.tavernCandidates = generateTavern(registry, rng, count)
  return true
}
