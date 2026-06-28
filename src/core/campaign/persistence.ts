/**
 * Персистентность (§15): localStorage envelope { version, campaign } + миграции.
 */

import type { CampaignState } from '../types/campaign'
import { SAVE_VERSION } from './newgame'

const STORAGE_KEY = 'gen-sp-clone:campaign'

export interface SaveEnvelope {
  version: number
  campaign: CampaignState
}

/** Миграции схемы при росте SAVE_VERSION (§15). */
export function migrate(envelope: SaveEnvelope): SaveEnvelope {
  let env = envelope
  // пример каркаса миграций; при изменении структуры добавлять шаги:
  // if (env.version < 2) { env = { version: 2, campaign: ...transform... } }
  if (env.version > SAVE_VERSION) {
    // сейв новее кода — возвращаем как есть, пусть валидируется загрузкой
    return env
  }
  env.campaign.version = SAVE_VERSION
  return { version: SAVE_VERSION, campaign: env.campaign }
}

export function saveCampaign(campaign: CampaignState): void {
  try {
    const env: SaveEnvelope = { version: SAVE_VERSION, campaign }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(env))
  } catch {
    // localStorage недоступен (SSR/тест) — игнорируем
  }
}

export function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveEnvelope
    if (typeof parsed?.version !== 'number' || !parsed.campaign) return null
    return migrate(parsed).campaign
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export { STORAGE_KEY }
