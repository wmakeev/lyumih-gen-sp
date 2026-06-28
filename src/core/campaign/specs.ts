/**
 * Интерпретация склонностей (§11): флаги для бросков и слотов владельца,
 * мета-эффекты команды.
 */

import type { Character } from '../types/character'
import type { ContentRegistry } from '../types/content'
import type { StatId } from '../types/stats'

export interface LuckyFlags {
  card: boolean
  item: boolean
  passive: boolean
  unit: boolean
}

export function luckyFlags(ch: Character, registry: ContentRegistry): LuckyFlags {
  const spec = registry.specializations.get(ch.specializationId)
  const flags: LuckyFlags = { card: false, item: false, passive: false, unit: false }
  if (spec?.effect.type === 'lucky') flags[spec.effect.target] = true
  return flags
}

/** Оффер из 4 модов вместо 3 при mod_offer_plus (§11.2). */
export function offerCountFor(ch: Character, registry: ContentRegistry): 3 | 4 {
  const spec = registry.specializations.get(ch.specializationId)
  return spec?.effect.type === 'mod_offer_plus' ? 4 : 3
}

/** Доп. слот умений/пассивов от slot_* (§11.2). */
export function slotBonuses(ch: Character, registry: ContentRegistry): {
  skill: number
  passive: number
} {
  const spec = registry.specializations.get(ch.specializationId)
  let skill = 0
  let passive = 0
  if (spec?.effect.type === 'slot_skill_plus') skill += spec.effect.amount
  if (spec?.effect.type === 'slot_passive_plus') passive += spec.effect.amount
  return { skill, passive }
}

/** Поддержка soft-rollback при удалении мода (§16.9.1). */
export function hasSoftRollback(ch: Character, registry: ContentRegistry): boolean {
  return registry.specializations.get(ch.specializationId)?.effect.type === 'mod_soft_rollback'
}

export interface SquadMeta {
  dropSkillBonus: number
  dropPassiveBonus: number
  goldBonus: number
  statBonus: Partial<Record<StatId, number>>
}

/**
 * Агрегирует мета-эффекты отряда (§11.1): действуют на всю команду, если
 * владелец в отряде; дубликаты — берётся лучший, не суммируются.
 */
export function aggregateSquadMeta(
  squad: Character[],
  registry: ContentRegistry,
): SquadMeta {
  const meta: SquadMeta = {
    dropSkillBonus: 0,
    dropPassiveBonus: 0,
    goldBonus: 0,
    statBonus: {},
  }
  for (const ch of squad) {
    const spec = registry.specializations.get(ch.specializationId)
    if (!spec) continue
    const e = spec.effect
    if (e.type === 'meta_drop' && e.what === 'skill')
      meta.dropSkillBonus = Math.max(meta.dropSkillBonus, e.bonus)
    else if (e.type === 'meta_drop' && e.what === 'passive')
      meta.dropPassiveBonus = Math.max(meta.dropPassiveBonus, e.bonus)
    else if (e.type === 'meta_gold') meta.goldBonus = Math.max(meta.goldBonus, e.bonus)
    else if (e.type === 'meta_stat')
      meta.statBonus[e.stat] = Math.max(meta.statBonus[e.stat] ?? 0, e.bonus)
  }
  return meta
}
