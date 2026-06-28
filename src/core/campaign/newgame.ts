/**
 * Инициализация новой кампании.
 */

import type { Rng } from '../rng'
import type { GameConfig } from '../config'
import type { CampaignState } from '../types/campaign'
import type { ContentRegistry } from '../types/content'
import { createStartingHero } from './factory'
import { generateShopOffer } from './shop'
import { generateTavern } from './tavern'

export const SAVE_VERSION = 1
const STARTING_GOLD = 250
const TAVERN_COUNT = 4

export function createNewCampaign(
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): CampaignState {
  const hero = createStartingHero(registry, rng)
  return {
    version: SAVE_VERSION,
    scenarioIndex: 0,
    worldPower: 0,
    gold: STARTING_GOLD,
    phase: 'hub',
    characters: [hero],
    squad: [hero.id, null, null, null],
    expedition: null,
    chest: { items: [], unboundCards: [], unboundPassives: [] },
    shopOffers: generateShopOffer(registry, config, rng),
    tavernCandidates: generateTavern(registry, rng, TAVERN_COUNT),
    codexDiscovered: [`class:${hero.classId}`],
    battle: null,
    battleAttemptSnapshot: null,
    battleAttemptId: 0,
    pendingHubNotice: null,
  }
}
