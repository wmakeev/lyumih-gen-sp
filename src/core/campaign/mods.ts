/**
 * Действия игрока над слотами модов носителей (§16.8–16.9.1): выбор мода из
 * оффера и удаление мода с откатом уровня. Резолвит носителя (умение/предмет/
 * пассив) персонажа, подбирает теги/пул/offerCount/soft-rollback и делегирует в
 * чистые функции memento/slots. Возвращает false при невалидном запросе (вместо
 * исключений ядра) — стор остаётся безопасным.
 */

import type { GameConfig } from '../config'
import type { Rng } from '../rng'
import type { Character } from '../types/character'
import type { ContentRegistry } from '../types/content'
import type { ModSlotState, ModTemplate } from '../types/memento'
import { pickMod as pickModSlot, removeMod as removeModSlot } from '../memento/slots'
import { offerCountFor, hasSoftRollback } from './specs'

export type CarrierKind = 'card' | 'item' | 'passive'

interface CarrierRef {
  slots: ModSlotState[]
  level: number
  setLevel: (n: number) => void
  tags: string[]
  pool: ModTemplate[]
}

function resolveCarrier(
  ch: Character,
  kind: CarrierKind,
  carrierId: string,
  registry: ContentRegistry,
): CarrierRef | null {
  if (kind === 'card') {
    const inst = ch.cards.find((c) => c.id === carrierId)
    if (!inst) return null
    return {
      slots: inst.modSlots,
      level: inst.global_level,
      setLevel: (n) => (inst.global_level = n),
      tags: registry.cards.get(inst.templateId)?.tags ?? ['skill'],
      pool: [...registry.cardItemMods.values()],
    }
  }
  if (kind === 'item') {
    const inst = ch.items.find((i) => i.id === carrierId)
    if (!inst) return null
    return {
      slots: inst.modSlots,
      level: inst.itemLevel,
      setLevel: (n) => (inst.itemLevel = n),
      tags: registry.items.get(inst.templateId)?.tags ?? ['weapon'],
      pool: [...registry.cardItemMods.values()],
    }
  }
  const inst = ch.passives.find((p) => p.id === carrierId)
  if (!inst) return null
  return {
    slots: inst.modSlots,
    level: inst.global_level,
    setLevel: (n) => (inst.global_level = n),
    tags: registry.passives.get(inst.templateId)?.tags ?? ['passive'],
    pool: [...registry.passiveMods.values()],
  }
}

/** Выбор мода из оффера слота (§16.8). false — слот не пуст / мод не в оффере. */
export function pickCarrierMod(
  ch: Character,
  kind: CarrierKind,
  carrierId: string,
  slotIndex: number,
  templateId: string,
  registry: ContentRegistry,
): boolean {
  const ref = resolveCarrier(ch, kind, carrierId, registry)
  if (!ref) return false
  const slot = ref.slots[slotIndex]
  if (!slot || slot.status !== 'empty') return false
  if (slot.offer && !slot.offer.modIds.includes(templateId)) return false
  pickModSlot(ref.slots, slotIndex, templateId)
  return true
}

/** Удаление мода (§16.9.1): слот → empty с новым оффером, откат уровня. */
export function removeCarrierMod(
  ch: Character,
  kind: CarrierKind,
  carrierId: string,
  slotIndex: number,
  registry: ContentRegistry,
  config: GameConfig,
  rng: Rng,
): boolean {
  const ref = resolveCarrier(ch, kind, carrierId, registry)
  if (!ref) return false
  const slot = ref.slots[slotIndex]
  if (!slot || slot.status !== 'filled') return false
  const { newLevel } = removeModSlot(ref.slots, slotIndex, ref.level, {
    carrierTags: ref.tags,
    pool: ref.pool,
    milestones: config.modSlotMilestones,
    offerCount: offerCountFor(ch, registry),
    rng,
    softRollback: hasSoftRollback(ch, registry),
  })
  ref.setLevel(newLevel)
  return true
}
