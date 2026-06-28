/**
 * Слоты модификаторов: вехи, синхронизация с уровнем, офферы, удаление (§16.8–16.9.1).
 */

import type { MilestoneConfig } from '../config'
import { SeededRng, type Rng } from '../rng'
import type { ModOffer, ModSlotState, ModTemplate } from '../types/memento'

/** Порог уровня для слота с индексом slotIndex (§16.8). */
export function milestoneThreshold(slotIndex: number, m: MilestoneConfig): number {
  return m.firstThreshold + m.step * slotIndex
}

/** Сколько слотов открыто при данном уровне носителя (§16.8). */
export function unlockedSlotCount(carrierLevel: number, m: MilestoneConfig): number {
  if (carrierLevel < m.firstThreshold) return 0
  let count = 0
  while (carrierLevel >= milestoneThreshold(count, m)) count++
  return count
}

/**
 * Генерация оффера (§16.9). Детерминирована по seed.
 *  1. Пул = моды, где carrierTags ⊇ requires и carrierTags ∩ excludes = ∅.
 *  2. Исключить моды, конфликтующие с occupiedTemplateIds (excludes ∩ occupied).
 *  3. Выбрать offerCount штук (повторения разрешены) seeded PRNG.
 */
export function generateOffer(
  carrierTags: readonly string[],
  occupiedTemplateIds: readonly string[],
  _slotIndex: number,
  seed: number,
  pool: readonly ModTemplate[],
  offerCount: 3 | 4,
): ModOffer {
  const tags = new Set(carrierTags)
  const occupied = new Set(occupiedTemplateIds)

  const eligible = pool.filter((mod) => {
    if (mod.enabled === false) return false
    if (!mod.requires.every((t) => tags.has(t))) return false
    const excl = mod.excludes ?? []
    if (excl.some((t) => tags.has(t))) return false
    if (excl.some((id) => occupied.has(id))) return false
    return true
  })

  const rng: Rng = new SeededRng(seed)
  const modIds: string[] = []
  if (eligible.length > 0) {
    for (let i = 0; i < offerCount; i++) {
      modIds.push(rng.pick(eligible).id)
    }
  }
  return { modIds, rollSeed: seed }
}

export interface SyncOptions {
  carrierTags: readonly string[]
  pool: readonly ModTemplate[]
  milestones: MilestoneConfig
  /** 3 (база) или 4 при склонности mod_offer_plus (§11.2). */
  offerCount: 3 | 4
  /** Источник seed для новых офферов (детерминизм при seeded Rng). */
  rng: Rng
}

/** Список templateId занятых (filled) слотов — для excludes-фильтра. */
export function occupiedTemplateIds(slots: readonly ModSlotState[]): string[] {
  const out: string[] = []
  for (const s of slots) if (s.status === 'filled') out.push(s.templateId)
  return out
}

/**
 * Синхронизирует число слотов с уровнем носителя (§16.8). При пересечении вехи
 * добавляет новый empty-слот с offer. Существующие слоты не трогает.
 * Мутирует и возвращает массив слотов.
 */
export function syncModSlotsForLevel(
  slots: ModSlotState[],
  carrierLevel: number,
  opts: SyncOptions,
): ModSlotState[] {
  const target = unlockedSlotCount(carrierLevel, opts.milestones)
  while (slots.length < target) {
    const slotIndex = slots.length
    const seed = opts.rng.int(1, 0x7fffffff)
    const offer = generateOffer(
      opts.carrierTags,
      occupiedTemplateIds(slots),
      slotIndex,
      seed,
      opts.pool,
      opts.offerCount,
    )
    slots.push({ status: 'empty', offer })
  }
  return slots
}

/** Выбор мода из оффера слота (§16.8): слот → filled с lm=0. */
export function pickMod(
  slots: ModSlotState[],
  slotIndex: number,
  templateId: string,
): ModSlotState[] {
  const slot = slots[slotIndex]
  if (!slot || slot.status !== 'empty') {
    throw new Error(`pickMod: slot ${slotIndex} не пуст или отсутствует`)
  }
  if (slot.offer && !slot.offer.modIds.includes(templateId)) {
    throw new Error(`pickMod: ${templateId} нет в оффере слота ${slotIndex}`)
  }
  slots[slotIndex] = { status: 'filled', templateId, lm: 0 }
  return slots
}

export interface RemoveModOptions extends SyncOptions {
  /** Склонность mod_soft_rollback: потеря 20% прогресса внутри вехи (§16.9.1). */
  softRollback?: boolean
}

/**
 * Удаление мода (§16.9.1). Возвращает новый уровень носителя; слот → empty с
 * новым оффером; lm удалённого мода теряется; старшие слоты не трогаются.
 */
export function removeMod(
  slots: ModSlotState[],
  slotIndex: number,
  carrierLevel: number,
  opts: RemoveModOptions,
): { slots: ModSlotState[]; newLevel: number } {
  const slot = slots[slotIndex]
  if (!slot || slot.status !== 'filled') {
    throw new Error(`removeMod: slot ${slotIndex} не filled`)
  }

  const floor =
    slotIndex === 0 ? 0 : milestoneThreshold(slotIndex - 1, opts.milestones)

  let newLevel: number
  if (opts.softRollback) {
    // потеря 20% прогресса внутри текущей вехи вместо отката к порогу
    const milestone = milestoneThreshold(slotIndex, opts.milestones)
    const progressInTier = Math.max(0, carrierLevel - milestone)
    newLevel = Math.max(floor, Math.round(milestone + progressInTier * 0.8))
  } else {
    newLevel = floor
  }

  // слот → empty с новым оффером (старшие слоты не трогаем)
  const seed = opts.rng.int(1, 0x7fffffff)
  const others = occupiedTemplateIds(slots.filter((_, i) => i !== slotIndex))
  const offer = generateOffer(
    opts.carrierTags,
    others,
    slotIndex,
    seed,
    opts.pool,
    opts.offerCount,
  )
  slots[slotIndex] = { status: 'empty', offer }

  return { slots, newLevel }
}
