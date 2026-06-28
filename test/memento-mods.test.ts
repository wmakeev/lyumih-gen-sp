import { describe, it, expect } from 'vitest'
import {
  collectModEffects,
  scaleByLm,
  applyDamageMult,
  rollProcExtraHits,
  resolveCarrierMods,
} from '../src/core/memento/mods'
import { SeededRng } from '../src/core/rng'
import type { ModSlotState, ModTemplate } from '../src/core/types/memento'

describe('scaleByLm (§16.10)', () => {
  it('percent-op удваивается при lm=100', () => {
    expect(scaleByLm(20, 0)).toBe(20)
    expect(scaleByLm(20, 100)).toBe(40)
    expect(scaleByLm(20, 50)).toBe(30)
  })
})

describe('collectModEffects + applyDamageMult', () => {
  const dmgMod: ModTemplate = {
    id: 'd',
    label: 'dmg',
    group: 'damage',
    requires: [],
    ops: [{ kind: 'damage_mult', base: 50, scaleMode: 'percent' }],
    descriptionLines: [],
  }

  it('damage_mult: +50% при lm=0, +100% при lm=100', () => {
    const e0 = collectModEffects([{ template: dmgMod, lm: 0 }])
    expect(applyDamageMult(100, e0)).toBe(150)
    const e100 = collectModEffects([{ template: dmgMod, lm: 100 }])
    expect(applyDamageMult(100, e100)).toBe(200)
  })

  it('range_add суммируется (flat, масштаб по lm)', () => {
    const rangeMod: ModTemplate = {
      id: 'r',
      label: 'rng',
      group: 'utility',
      requires: [],
      ops: [{ kind: 'range_add', base: 2, scaleMode: 'flat' }],
      descriptionLines: [],
    }
    const e = collectModEffects([
      { template: rangeMod, lm: 0 },
      { template: rangeMod, lm: 100 },
    ])
    expect(e.rangeAdd).toBe(2 + 4) // 2 + scaleByLm(2,100)=4
  })
})

describe('proc_extra_hit (§16.12)', () => {
  const procMod: ModTemplate = {
    id: 'p',
    label: 'proc',
    group: 'damage',
    requires: [],
    ops: [{ kind: 'proc_extra_hit', baseChance: 100, hits: 1 }],
    descriptionLines: [],
  }

  it('гарантированный прок (chance 100%) даёт доп. удар', () => {
    const e = collectModEffects([{ template: procMod, lm: 0 }])
    expect(rollProcExtraHits(e, new SeededRng(1))).toBe(1)
  })

  it('нулевой шанс не прокает', () => {
    const zero: ModTemplate = {
      ...procMod,
      ops: [{ kind: 'proc_extra_hit', baseChance: 0, hits: 3 }],
    }
    const e = collectModEffects([{ template: zero, lm: 0 }])
    expect(rollProcExtraHits(e, new SeededRng(1))).toBe(0)
  })
})

describe('resolveCarrierMods', () => {
  it('берёт только filled-слоты с известными шаблонами', () => {
    const tpl: ModTemplate = {
      id: 'x',
      label: 'x',
      group: 'damage',
      requires: [],
      ops: [],
      descriptionLines: [],
    }
    const registry = new Map([['x', tpl]])
    const slots: ModSlotState[] = [
      { status: 'filled', templateId: 'x', lm: 10 },
      { status: 'empty', offer: null },
      { status: 'filled', templateId: 'unknown', lm: 5 },
    ]
    const resolved = resolveCarrierMods(slots, registry)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.lm).toBe(10)
  })
})
