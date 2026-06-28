import { describe, it, expect } from 'vitest'
import {
  milestoneThreshold,
  unlockedSlotCount,
  generateOffer,
  syncModSlotsForLevel,
  pickMod,
  removeMod,
} from '../src/core/memento/slots'
import { getProfile } from '../src/core/config'
import { SeededRng } from '../src/core/rng'
import type { ModSlotState, ModTemplate } from '../src/core/types/memento'

const PROD = getProfile('production').modSlotMilestones // {75,100}
const DEV = getProfile('development').modSlotMilestones // {5,5}

describe('milestoneThreshold / unlockedSlotCount (§16.8)', () => {
  it('production пороги 75/175/275', () => {
    expect(milestoneThreshold(0, PROD)).toBe(75)
    expect(milestoneThreshold(1, PROD)).toBe(175)
    expect(milestoneThreshold(2, PROD)).toBe(275)
    expect(unlockedSlotCount(74, PROD)).toBe(0)
    expect(unlockedSlotCount(75, PROD)).toBe(1)
    expect(unlockedSlotCount(174, PROD)).toBe(1)
    expect(unlockedSlotCount(175, PROD)).toBe(2)
    expect(unlockedSlotCount(275, PROD)).toBe(3)
  })

  it('development пороги 5/10/15', () => {
    expect(unlockedSlotCount(4, DEV)).toBe(0)
    expect(unlockedSlotCount(5, DEV)).toBe(1)
    expect(unlockedSlotCount(10, DEV)).toBe(2)
    expect(unlockedSlotCount(15, DEV)).toBe(3)
  })
})

const POOL: ModTemplate[] = [
  {
    id: 'm_melee',
    label: 'Melee mod',
    group: 'damage',
    requires: ['melee'],
    ops: [{ kind: 'damage_mult', base: 20, scaleMode: 'percent' }],
    descriptionLines: [],
  },
  {
    id: 'm_ranged',
    label: 'Ranged mod',
    group: 'utility',
    requires: ['ranged'],
    ops: [{ kind: 'range_add', base: 1, scaleMode: 'flat' }],
    descriptionLines: [],
  },
  {
    id: 'm_weapon',
    label: 'Weapon mod',
    group: 'damage',
    requires: ['weapon'],
    excludes: ['m_melee'],
    ops: [{ kind: 'crit_chance_add', base: 5, scaleMode: 'percent' }],
    descriptionLines: [],
  },
  {
    id: 'm_disabled',
    label: 'Disabled',
    group: 'damage',
    requires: ['melee'],
    enabled: false,
    ops: [],
    descriptionLines: [],
  },
]

describe('generateOffer (§16.9)', () => {
  it('requires-фильтр: только подходящие по тегам', () => {
    const offer = generateOffer(['melee', 'weapon'], [], 0, 123, POOL, 3)
    // ranged-мод исключён (нет тега ranged), disabled исключён
    for (const id of offer.modIds) {
      expect(['m_melee', 'm_weapon']).toContain(id)
    }
    expect(offer.modIds).toHaveLength(3)
  })

  it('excludes по carrierTags', () => {
    // тег melee исключает m_weapon (m_weapon.excludes=[m_melee] — это id, не тег;
    // проверим обратный кейс через occupied ниже). Здесь ranged-only носитель:
    const offer = generateOffer(['ranged'], [], 0, 1, POOL, 3)
    expect(offer.modIds.every((id) => id === 'm_ranged')).toBe(true)
  })

  it('excludes по occupied слотам', () => {
    // при занятом m_melee мод m_weapon (excludes:[m_melee]) исключается
    const offer = generateOffer(['melee', 'weapon'], ['m_melee'], 1, 5, POOL, 3)
    expect(offer.modIds).not.toContain('m_weapon')
    expect(offer.modIds.every((id) => id === 'm_melee')).toBe(true)
  })

  it('детерминизм по seed', () => {
    const a = generateOffer(['melee', 'weapon'], [], 0, 999, POOL, 3)
    const b = generateOffer(['melee', 'weapon'], [], 0, 999, POOL, 3)
    expect(a.modIds).toEqual(b.modIds)
    const c = generateOffer(['melee', 'weapon'], [], 0, 1000, POOL, 3)
    // другой seed → (как правило) другой результат; хотя бы rollSeed отличается
    expect(c.rollSeed).not.toBe(a.rollSeed)
  })

  it('offerCount=4 при mod_offer_plus', () => {
    const offer = generateOffer(['melee'], [], 0, 7, POOL, 4)
    expect(offer.modIds).toHaveLength(4)
  })

  it('пустой пул → пустой offer', () => {
    const offer = generateOffer(['heal'], [], 0, 1, POOL, 3)
    expect(offer.modIds).toHaveLength(0)
  })
})

describe('syncModSlotsForLevel / pickMod / removeMod (§16.8, §16.9.1)', () => {
  function syncOpts(rng: SeededRng) {
    return {
      carrierTags: ['melee'],
      pool: POOL,
      milestones: DEV,
      offerCount: 3 as const,
      rng,
    }
  }

  it('открывает слоты на вехах, старые не трогает', () => {
    const slots: ModSlotState[] = []
    syncModSlotsForLevel(slots, 4, syncOpts(new SeededRng(1)))
    expect(slots).toHaveLength(0)
    syncModSlotsForLevel(slots, 5, syncOpts(new SeededRng(1)))
    expect(slots).toHaveLength(1)
    expect(slots[0]!.status).toBe('empty')

    // выберем мод в слот 0
    pickMod(slots, 0, 'm_melee')
    expect(slots[0]).toEqual({ status: 'filled', templateId: 'm_melee', lm: 0 })

    // поднимаем до 10 → второй слот, первый (filled) не трогается
    syncModSlotsForLevel(slots, 10, syncOpts(new SeededRng(2)))
    expect(slots).toHaveLength(2)
    expect(slots[0]!.status).toBe('filled')
    expect(slots[1]!.status).toBe('empty')
  })

  it('removeMod откатывает уровень к порогу предыдущей вехи', () => {
    const slots: ModSlotState[] = []
    syncModSlotsForLevel(slots, 12, syncOpts(new SeededRng(3))) // 2 слота (5,10)
    pickMod(slots, 0, 'm_melee')
    pickMod(slots, 1, 'm_melee')

    // удаляем slot 1 → уровень = milestoneThreshold(0)=5
    const r1 = removeMod(slots, 1, 12, syncOpts(new SeededRng(4)))
    expect(r1.newLevel).toBe(5)
    expect(slots[1]!.status).toBe('empty')
    expect(slots[0]!.status).toBe('filled') // младший слот цел

    // удаляем slot 0 → уровень = 0
    const r2 = removeMod(slots, 0, r1.newLevel, syncOpts(new SeededRng(5)))
    expect(r2.newLevel).toBe(0)
  })

  it('mod_soft_rollback теряет лишь 20% прогресса внутри вехи', () => {
    const slots: ModSlotState[] = []
    syncModSlotsForLevel(slots, 20, syncOpts(new SeededRng(6)))
    pickMod(slots, 0, 'm_melee')
    // slot 0 milestone=5; прогресс внутри вехи = 20-5=15; теряем 20% → 5+12=17
    const r = removeMod(slots, 0, 20, {
      ...syncOpts(new SeededRng(7)),
      softRollback: true,
    })
    expect(r.newLevel).toBe(17)
  })
})
