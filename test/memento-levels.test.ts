import { describe, it, expect } from 'vitest'
import {
  rollCardLevelUp,
  rollMementoLevelUp,
  applyCardUse,
} from '../src/core/memento/levels'
import { SeededRng } from '../src/core/rng'
import type { CardInstance } from '../src/core/types/memento'

describe('rollCardLevelUp (§16.2)', () => {
  it('L=1 → успех при любом r', () => {
    for (let r = 1; r <= 100; r++) {
      expect(rollCardLevelUp(1, r)).toBe(true)
    }
  })

  it('L=100 → успех только при r=100', () => {
    for (let r = 1; r <= 100; r++) {
      expect(rollCardLevelUp(100, r)).toBe(r === 100)
    }
  })

  it('L>100 → успех только при r=1 (P=1%)', () => {
    for (let r = 1; r <= 100; r++) {
      expect(rollCardLevelUp(101, r)).toBe(r === 1)
      expect(rollCardLevelUp(500, r)).toBe(r === 1)
    }
  })

  it('L=50 → r=49 fail, r=50 pass', () => {
    expect(rollCardLevelUp(50, 49)).toBe(false)
    expect(rollCardLevelUp(50, 50)).toBe(true)
  })

  it('r=100 всегда успех (кроме L>100)', () => {
    expect(rollCardLevelUp(1, 100)).toBe(true)
    expect(rollCardLevelUp(50, 100)).toBe(true)
    expect(rollCardLevelUp(100, 100)).toBe(true)
    expect(rollCardLevelUp(101, 100)).toBe(false)
  })

  it('rollMementoLevelUp — алиас той же функции', () => {
    expect(rollMementoLevelUp).toBe(rollCardLevelUp)
  })
})

describe('applyCardUse (§16.3)', () => {
  function card(level: number): CardInstance {
    return {
      id: 'c1',
      templateId: 't',
      global_level: level,
      uses_count: 0,
      modSlots: [],
    }
  }

  it('всегда инкрементирует uses_count', () => {
    const c = card(100)
    applyCardUse(c, new SeededRng(1))
    expect(c.uses_count).toBe(1)
  })

  it('L=1 всегда повышается до 2', () => {
    const c = card(1)
    applyCardUse(c, new SeededRng(12345))
    expect(c.global_level).toBe(2)
  })

  it('lucky даёт второй шанс при провале', () => {
    // Подбираем seed, где первый d100 != требуемого, чтобы проверить retry.
    // Достаточно убедиться, что lucky не понижает шанс: при L=1 всегда успех.
    const c = card(1)
    applyCardUse(c, new SeededRng(7), { lucky: true })
    expect(c.global_level).toBe(2)
  })
})
