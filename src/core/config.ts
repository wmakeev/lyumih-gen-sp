/**
 * Конфигурационные профили баланса.
 *
 * Спека (§9, §16.8) задаёт два набора чисел: production («релиз», медленный
 * прогресс) и development («песочница», быстрый прогресс для тестов/демо).
 *
 * Дефолт — development (см. PROGRESS.md / решение по проекту). Production
 * включается через VITE_GAME_PROFILE=production или setProfile('production').
 * Критерии приёмки §18.4 проверяются на production-порогах (75/175/…).
 */

export type ProfileId = 'development' | 'production'

export interface MilestoneConfig {
  /** Порог уровня для открытия слота 0 (§16.8). */
  firstThreshold: number
  /** Шаг между порогами последующих слотов. */
  step: number
}

export interface GameConfig {
  readonly id: ProfileId
  /** Вехи слотов модов (§16.8). */
  readonly modSlotMilestones: MilestoneConfig
  /** Магазин (§9.2). */
  readonly shop: {
    /** Слотов предметов в оффере. */
    readonly itemSlots: number
    /** Шанс умения в оффере (0..1), независимый roll. */
    readonly cardOfferChance: number
    /** Шанс пассива в оффере (0..1), независимый roll. */
    readonly passiveOfferChance: number
    /** Цена покупки умения/пассива. */
    readonly cardPrice: number
    /** Стоимость обновления магазина. */
    readonly refreshCost: number
  }
  /** Дроп после боя (§9.3). */
  readonly drop: {
    /** Шанс умения (0..1). */
    readonly cardChance: number
    /** Шанс пассива (0..1), независимый roll. */
    readonly passiveChance: number
  }
}

const PRODUCTION: GameConfig = {
  id: 'production',
  modSlotMilestones: { firstThreshold: 75, step: 100 },
  shop: {
    itemSlots: 5,
    cardOfferChance: 0.03,
    passiveOfferChance: 0.03,
    cardPrice: 1000,
    refreshCost: 100,
  },
  drop: {
    cardChance: 0.01,
    passiveChance: 0.01,
  },
}

const DEVELOPMENT: GameConfig = {
  id: 'development',
  modSlotMilestones: { firstThreshold: 5, step: 5 },
  shop: {
    itemSlots: 5,
    cardOfferChance: 0.5,
    passiveOfferChance: 0.5,
    cardPrice: 100,
    refreshCost: 10,
  },
  drop: {
    cardChance: 0.1,
    passiveChance: 0.1,
  },
}

const PROFILES: Record<ProfileId, GameConfig> = {
  production: PRODUCTION,
  development: DEVELOPMENT,
}

function resolveDefaultProfile(): ProfileId {
  // В тестах/Node берём dev по умолчанию; в браузере читаем VITE_GAME_PROFILE.
  const fromEnv =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GAME_PROFILE
  if (fromEnv === 'production' || fromEnv === 'development') return fromEnv
  return 'development'
}

let activeProfile: ProfileId = resolveDefaultProfile()

/** Текущий активный конфиг. */
export function getConfig(): GameConfig {
  return PROFILES[activeProfile]
}

/** Переключить профиль (используется в тестах §18.4 и в UI-настройках). */
export function setProfile(id: ProfileId): void {
  activeProfile = id
}

/** Явно получить конфиг конкретного профиля (для детерминированных тестов). */
export function getProfile(id: ProfileId): GameConfig {
  return PROFILES[id]
}

// --- Константы, не зависящие от профиля ---

/** §6.9 / §16.6: прирост worldPower за убийство врага. */
export const WORLD_POWER_PER_ENEMY_KILL = 1

/** §4.3: лимиты. */
export const LIMITS = {
  squadSlots: 4,
  maxRoster: 100,
  minRoster: 1,
  equipmentSlots: 3,
  baseLoadoutSize: 3,
  baseOwnedPassives: 4,
  baseEquippedPassives: 4,
} as const

/** §16.10: масштаб эффекта мода для percent-ops. */
export function modPercentScale(lm: number): number {
  return 1 + lm / 100
}
