import { describe, it, expect } from 'vitest'
import {
  rollFilledModSlots,
  rollEquippedItemLevel,
  rollUnitLevel,
} from '../src/core/memento/victory'
import { SeededRng } from '../src/core/rng'
import type { ItemInstance, ModSlotState } from '../src/core/types/memento'

describe('rollFilledModSlots (§16.7)', () => {
  it('бросает Lm только для filled-слотов', () => {
    const slots: ModSlotState[] = [
      { status: 'filled', templateId: 'a', lm: 1 }, // L=1 → всегда +1
      { status: 'empty', offer: null },
      { status: 'filled', templateId: 'b', lm: 1 },
    ]
    rollFilledModSlots(slots, new SeededRng(1))
    expect(slots[0]).toMatchObject({ status: 'filled', lm: 2 })
    expect(slots[1]!.status).toBe('empty')
    expect(slots[2]).toMatchObject({ status: 'filled', lm: 2 })
  })
})

describe('rollEquippedItemLevel (§16.7, §16.5)', () => {
  function item(level: number): ItemInstance {
    return { id: 'i', templateId: 't', itemLevel: level, modSlots: [] }
  }
  it('itemLevel=1 всегда растёт', () => {
    const it1 = item(1)
    expect(rollEquippedItemLevel(it1, new SeededRng(2))).toBe(true)
    expect(it1.itemLevel).toBe(2)
  })
  it('«кулаки» (itemLevel 0) не прогрессируют', () => {
    const fists = item(0)
    expect(rollEquippedItemLevel(fists, new SeededRng(2))).toBe(false)
    expect(fists.itemLevel).toBe(0)
  })
})

describe('rollUnitLevel (§16.6)', () => {
  it('L=1 → 2; высокий уровень обычно остаётся', () => {
    expect(rollUnitLevel(1, new SeededRng(3))).toBe(2)
    // L=100 повышается только при r=100 — для большинства seed остаётся 100
    const stays = rollUnitLevel(100, new SeededRng(3))
    expect([100, 101]).toContain(stays)
  })
})
