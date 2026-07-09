/**
 * Контракт единого резолвера исхода карты (§6.5–6.6): resolveCardOutcome —
 * чистая функция, общий источник для движка, превью и ИИ.
 */
import { describe, it, expect } from 'vitest'
import { resolveCardOutcome, NO_CRIT, ALL_CRIT } from '../src/core/battle/outcome'
import type { CardTemplate } from '../src/core/types/cards'
import type { ModTemplate } from '../src/core/types/memento'
import type { ModSlotState } from '../src/core/types/memento'
import { SeededRng } from '../src/core/rng'
import {
  makeUnit,
  makeState,
  makeContext,
  makeCard,
  makeBasicCard,
  stats,
  STRIKE_CARD,
} from './helpers/battle-fixtures'

const FIREBALL: CardTemplate = {
  id: 'fireball',
  label: 'Огненный шар',
  kind: 'ranged',
  maxRange: 5,
  statSource: 'magicPower',
  skillFlat: 8,
  scaleToken: '0%%',
  cooldownTurns: 2,
  tags: ['ranged', 'skill'],
}

const BLAST: CardTemplate = {
  id: 'blast',
  label: 'Взрыв',
  kind: 'aoe',
  maxRange: 5,
  statSource: 'magicPower',
  skillFlat: 10,
  scaleToken: '0%%',
  cooldownTurns: 3,
  tags: ['aoe', 'skill'],
  aoeRadius: 1,
}

const HEAL: CardTemplate = {
  id: 'heal',
  label: 'Лечение',
  kind: 'heal',
  maxRange: 3,
  statSource: 'healPower',
  skillFlat: 12,
  scaleToken: '0%%',
  cooldownTurns: 2,
  tags: ['heal', 'skill'],
}

const RESURRECT: CardTemplate = {
  id: 'resurrect',
  label: 'Воскрешение',
  kind: 'resurrect',
  maxRange: 2,
  statSource: 'healPower',
  skillFlat: 15,
  scaleToken: '0%%',
  cooldownTurns: 5,
  tags: ['heal', 'skill'],
}

const WARCRY: CardTemplate = {
  id: 'warcry',
  label: 'Клич',
  kind: 'buff',
  maxRange: 2,
  statSource: 'attack',
  skillFlat: 0,
  scaleToken: '0%%',
  cooldownTurns: 3,
  tags: ['skill'],
  status: { id: 'rage', duration: 2, statMods: { attack: 5 } },
}

const MOD_RANGE: ModTemplate = {
  id: 'm_range',
  label: '+дальность',
  group: 'utility',
  requires: [],
  descriptionLines: [],
  ops: [{ kind: 'range_add', base: 2, scaleMode: 'flat' }],
}

const MOD_AOE_CENTER: ModTemplate = {
  id: 'm_center',
  label: 'центр AoE ×2',
  group: 'damage',
  requires: [],
  descriptionLines: [],
  // aoe_center_damage_mult += base/100 → +1 → итог множитель 2.
  ops: [{ kind: 'aoe_center_damage_mult', base: 100, scaleMode: 'percent' }],
}

function filledSlot(templateId: string): ModSlotState {
  return { status: 'filled', templateId, lm: 0 }
}

describe('resolveCardOutcome — сбор целей по видам карт', () => {
  it('basic/ranged: поражает вражескую цель, дальность и зона верны', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ magicPower: 4 }) })
    const foe = makeUnit({ id: 'f', side: 'enemy', x: 3, y: 0, hp: 50, maxHp: 50 })
    const ally = makeUnit({ id: 'a', side: 'player', x: 1, y: 0 })
    const st = makeState([caster, foe, ally])
    const ctx = makeContext([FIREBALL])
    const card = makeCard({ instanceId: 'fb', templateId: 'fireball' })

    const out = resolveCardOutcome(st, caster, card, { x: 3, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(out).not.toBeNull()
    expect(out.inRange).toBe(true)
    expect(out.range).toBe(5)
    // только вражеская цель, не союзник
    expect(out.targets.map((t) => t.unitId)).toEqual(['f'])
    expect(out.targets[0]!.kind).toBe('damage')
    // зона одиночной карты — только точка прицела
    expect([...out.zone]).toEqual(['3,0'])
  })

  it('aoe: собирает всех врагов в радиусе, зона включает пустые клетки', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 3, stats: stats({ magicPower: 6 }) })
    const e1 = makeUnit({ id: 'e1', side: 'enemy', x: 3, y: 3, hp: 40, maxHp: 40 })
    const e2 = makeUnit({ id: 'e2', side: 'enemy', x: 4, y: 3, hp: 40, maxHp: 40 })
    const eFar = makeUnit({ id: 'e3', side: 'enemy', x: 3, y: 6, hp: 40, maxHp: 40 })
    const st = makeState([caster, e1, e2, eFar])
    const ctx = makeContext([BLAST])
    const card = makeCard({ instanceId: 'bl', templateId: 'blast', kind: 'aoe' })

    const out = resolveCardOutcome(st, caster, card, { x: 3, y: 3 }, { ...ctx, rng: NO_CRIT })!
    expect(out.isAoe).toBe(true)
    expect(new Set(out.targets.map((t) => t.unitId))).toEqual(new Set(['e1', 'e2']))
    // радиус 1 вокруг (3,3), вдали от края: полный ромб = 5 клеток
    expect(out.zone.size).toBe(5)
    expect(out.zone.has('3,3')).toBe(true)
    expect(out.zone.has('4,3')).toBe(true)
  })

  it('heal: поражает раненого союзника (не врага)', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ healPower: 5 }) })
    const ally = makeUnit({ id: 'a', side: 'player', x: 1, y: 0, hp: 5, maxHp: 50 })
    const foe = makeUnit({ id: 'f', side: 'enemy', x: 2, y: 0 })
    const st = makeState([caster, ally, foe])
    const ctx = makeContext([HEAL])
    const card = makeCard({ instanceId: 'h', templateId: 'heal', kind: 'heal' })

    const out = resolveCardOutcome(st, caster, card, { x: 1, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(out.isHeal).toBe(true)
    expect(out.targets.map((t) => t.unitId)).toEqual(['a'])
    expect(out.targets[0]!.kind).toBe('heal')
    // величина лечения = skillFlat 12 + healPower 5 = 17
    expect(out.targets[0]!.hits[0]!.amount).toBe(17)
  })

  it('resurrect: поражает только downed-союзника', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ healPower: 5 }) })
    const downed = makeUnit({ id: 'd', side: 'player', x: 1, y: 0, hp: 0, maxHp: 40 })
    const st = makeState([caster, downed, makeUnit({ id: 'e', side: 'enemy', x: 5, y: 5 })])
    const ctx = makeContext([RESURRECT])
    const card = makeCard({ instanceId: 'r', templateId: 'resurrect', kind: 'resurrect' })

    const out = resolveCardOutcome(st, caster, card, { x: 1, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(out.isResurrect).toBe(true)
    expect(out.targets.map((t) => t.unitId)).toEqual(['d'])
    expect(out.targets[0]!.kind).toBe('resurrect')
  })

  it('buff: статус-цель без числовой величины', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0 })
    const ally = makeUnit({ id: 'a', side: 'player', x: 1, y: 0, hp: 30, maxHp: 30 })
    const st = makeState([caster, ally, makeUnit({ id: 'e', side: 'enemy', x: 5, y: 5 })])
    const ctx = makeContext([WARCRY])
    const card = makeCard({ instanceId: 'w', templateId: 'warcry', kind: 'buff' })

    const out = resolveCardOutcome(st, caster, card, { x: 1, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(out.isStatus).toBe(true)
    expect(out.targets[0]!.kind).toBe('status')
    expect(out.targets[0]!.hits).toEqual([])
  })
})

describe('resolveCardOutcome — мод-эффекты исхода', () => {
  it('rangeAdd расширяет эффективную дальность и достижимость', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ magicPower: 4 }) })
    const foe = makeUnit({ id: 'f', side: 'enemy', x: 7, y: 0, hp: 50, maxHp: 50 })
    const st = makeState([caster, foe])
    const ctx = makeContext([FIREBALL], [MOD_RANGE])
    const bare = makeCard({ instanceId: 'fb', templateId: 'fireball' })
    const modded = makeCard({ instanceId: 'fb2', templateId: 'fireball', modSlots: [filledSlot('m_range')] })

    // без мода: дальность 5 < 7 → недостижимо
    const noMod = resolveCardOutcome(st, caster, bare, { x: 7, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(noMod.range).toBe(5)
    expect(noMod.inRange).toBe(false)
    // с модом +2 → дальность 7 → достижимо
    const withMod = resolveCardOutcome(st, caster, modded, { x: 7, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(withMod.range).toBe(7)
    expect(withMod.inRange).toBe(true)
  })

  it('aoeCenterDamageMult умножает урон по цели в центре, но не по краю', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ magicPower: 0, critChance: 0 }) })
    const center = makeUnit({ id: 'c0', side: 'enemy', x: 3, y: 0, hp: 100, maxHp: 100, stats: stats({ defense: 0, health: 100 }) })
    const edge = makeUnit({ id: 'e1', side: 'enemy', x: 3, y: 1, hp: 100, maxHp: 100, stats: stats({ defense: 0, health: 100 }) })
    const st = makeState([caster, center, edge])
    const ctx = makeContext([BLAST], [MOD_AOE_CENTER])
    const card = makeCard({ instanceId: 'bl', templateId: 'blast', kind: 'aoe', modSlots: [filledSlot('m_center')] })

    const out = resolveCardOutcome(st, caster, card, { x: 3, y: 0 }, { ...ctx, rng: NO_CRIT })!
    expect(out.effects.aoeCenterDamageMult).toBe(2)
    const byId = new Map(out.targets.map((t) => [t.unitId, t.hits[0]!.amount]))
    // база = skillFlat 10; центр ×2 = 20, край = 10
    expect(byId.get('c0')).toBe(20)
    expect(byId.get('e1')).toBe(10)
  })
})

describe('resolveCardOutcome — детерминизм и крит-ветка', () => {
  it('одинаковый ввод при равных seed даёт одинаковый исход', () => {
    const mk = () => {
      const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ attack: 10, critChance: 50 }) })
      const foe = makeUnit({ id: 'f', side: 'enemy', x: 1, y: 0, hp: 100, maxHp: 100, stats: stats({ defense: 2, health: 100 }) })
      return { st: makeState([caster, foe]), caster, foe }
    }
    const a = mk()
    const b = mk()
    const ctx = makeContext([STRIKE_CARD])
    const card = makeBasicCard({ instanceId: 's' })

    const outA = resolveCardOutcome(a.st, a.caster, card, { x: 1, y: 0 }, { ...ctx, rng: new SeededRng(1234) })!
    const outB = resolveCardOutcome(b.st, b.caster, card, { x: 1, y: 0 }, { ...ctx, rng: new SeededRng(1234) })!
    expect(outA.targets[0]!.hits).toEqual(outB.targets[0]!.hits)
  })

  it('NO_CRIT даёт «пол», ALL_CRIT — крит-значение (больше)', () => {
    const caster = makeUnit({ id: 'c', side: 'player', x: 0, y: 0, stats: stats({ attack: 20, critChance: 100 }) })
    const foe = makeUnit({ id: 'f', side: 'enemy', x: 1, y: 0, hp: 200, maxHp: 200, stats: stats({ defense: 0, health: 200 }) })
    const st = makeState([caster, foe])
    const ctx = makeContext([STRIKE_CARD])
    const card = makeBasicCard({ instanceId: 's' })

    const floor = resolveCardOutcome(st, caster, card, { x: 1, y: 0 }, { ...ctx, rng: NO_CRIT })!
    const crit = resolveCardOutcome(st, caster, card, { x: 1, y: 0 }, { ...ctx, rng: ALL_CRIT })!
    expect(floor.targets[0]!.hits[0]!.isCrit).toBe(false)
    expect(crit.targets[0]!.hits[0]!.isCrit).toBe(true)
    expect(crit.targets[0]!.hits[0]!.amount).toBeGreaterThan(floor.targets[0]!.hits[0]!.amount)
    expect(floor.critChance).toBe(100)
  })
})
