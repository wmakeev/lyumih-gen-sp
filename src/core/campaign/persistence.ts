/**
 * Персистентность (§15): localStorage envelope { version, campaign } + миграции.
 */

import type { CampaignState } from '../types/campaign'
import { SAVE_VERSION } from './newgame'
import { getIdCounter, resetIdCounter } from './ids'

const STORAGE_KEY = 'gen-sp-clone:campaign'

export interface SaveEnvelope {
  version: number
  campaign: CampaignState
  /** Снимок монотонного счётчика id-инстансов (§15): без него nextId после
   * перезагрузки выдаёт уже занятые id и путает разные объекты. */
  idCounter?: number
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
  return { version: SAVE_VERSION, campaign: env.campaign, idCounter: env.idCounter }
}

export function saveCampaign(campaign: CampaignState): void {
  try {
    const env: SaveEnvelope = { version: SAVE_VERSION, campaign, idCounter: getIdCounter() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(env))
  } catch {
    // localStorage недоступен (SSR/тест) или превышена квота — игнорируем.
    // (Различение QuotaExceededError → UI-флаг «не сохранилось» — вне scope.)
  }
}

/** Минимальная проверка формы envelope: повреждённый сейв → null (fallback на новую игру). */
function isValidCampaign(c: unknown): c is CampaignState {
  if (!c || typeof c !== 'object') return false
  const v = c as Record<string, unknown>
  return (
    Array.isArray(v.characters) &&
    Array.isArray(v.squad) &&
    typeof v.phase === 'string' &&
    !!v.chest &&
    typeof v.chest === 'object'
  )
}

/** Фолбэк для сейвов без idCounter: обходит структуру, ищет id вида `prefix_<base36>`,
 * возвращает максимальное значение суффикса (чтобы nextId стартовал выше). */
function maxIdSuffix(root: unknown): number {
  let max = 0
  const seen = new Set<unknown>()
  const idRe = /^[a-z]+_([0-9a-z]+)$/
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      const m = idRe.exec(v)
      if (m?.[1]) {
        const n = parseInt(m[1], 36)
        if (Number.isFinite(n) && n > max) max = n
      }
      return
    }
    if (!v || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) v.forEach(walk)
    else for (const k of Object.values(v as Record<string, unknown>)) walk(k)
  }
  walk(root)
  return max
}

export function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SaveEnvelope
    if (typeof parsed?.version !== 'number' || !isValidCampaign(parsed.campaign)) return null
    const env = migrate(parsed)
    // Восстановить счётчик id ДО любого nextId, чтобы не выдавать занятые id (§15).
    // Старые сейвы без idCounter → фолбэк: max(существующих id)+? из суффиксов base36.
    resetIdCounter(typeof env.idCounter === 'number' ? env.idCounter : maxIdSuffix(env.campaign))
    return env.campaign
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
