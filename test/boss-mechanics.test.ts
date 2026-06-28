/**
 * Боссовые спец-механики (§13.4) и элементальные резисты рас (§13.3).
 * Проверяют точки входа движка: applyDamage / healUnit / onTurnStart /
 * basicAttack (reflect) / очередь (first_strike) и чистые помощники boss.ts.
 */
import { describe, it, expect } from 'vitest'
import { applyDamage, healUnit, onTurnStart, basicAttack } from '../src/core/battle/engine'
import { resolveCardAmount } from '../src/core/battle/damage'
import { computeTurnOrder } from '../src/core/battle/queue'
import { dodgeChance, elementTag, isMagicTag, BOSS } from '../src/core/battle/boss'
import { SeededRng } from '../src/core/rng'
import type { BattleContext } from '../src/core/battle/engine'
import {
  makeUnit,
  makeState,
  makeContext,
  stats,
  STRIKE_CARD,
} from './helpers/battle-fixtures'

function ctxWithResist(fn?: BattleContext['resist']): BattleContext {
  return { ...makeContext([STRIKE_CARD]), resist: fn }
}

describe('§13.3 элементальные резисты применяются в applyDamage', () => {
  it('множитель резиста по расе/стихии масштабирует урон', () => {
    const target = makeUnit({ id: 't', side: 'enemy', raceId: 'undead', hp: 200, maxHp: 200 })
    const st = makeState([makeUnit({ id: 'p' }), target])
    const ctx = ctxWithResist((_r, tag) => (tag === 'fire' ? 0.5 : 1))
    applyDamage(st, target, 100, 'fire', 'тест', ctx)
    expect(target.hp).toBe(150) // 100 * 0.5
  })

  it('без ctx.resist урон не масштабируется', () => {
    const target = makeUnit({ id: 't', side: 'enemy', hp: 200, maxHp: 200 })
    const st = makeState([target])
    applyDamage(st, target, 100, 'fire', 'тест')
    expect(target.hp).toBe(100)
  })
})

describe('§13.4 spell_shield ослабляет магический урон', () => {
  it('магический тег режется фактором, физический — нет', () => {
    const mk = () =>
      makeUnit({ id: 't', side: 'enemy', hp: 200, maxHp: 200, bossMechanics: ['spell_shield'] })
    const magic = mk()
    const phys = mk()
    const st = makeState([magic, phys])
    applyDamage(st, magic, 100, 'fire', 'x', ctxWithResist())
    applyDamage(st, phys, 100, 'physical', 'x', ctxWithResist())
    expect(magic.hp).toBe(200 - Math.round(100 * BOSS.spellShieldFactor))
    expect(phys.hp).toBe(100)
  })
})

describe('§13.4 damage_cap ограничивает урон за удар', () => {
  it('одиночный удар не превышает долю maxHp', () => {
    const boss = makeUnit({ id: 'b', side: 'enemy', hp: 100, maxHp: 100, bossMechanics: ['damage_cap'] })
    const st = makeState([boss])
    applyDamage(st, boss, 100, 'physical', 'x', ctxWithResist())
    expect(boss.hp).toBe(100 - Math.round((100 * BOSS.damageCapPct) / 100)) // 100 - 25
  })
})

describe('§13.4 уклонение (stealth/evasion)', () => {
  it('dodgeChance суммирует вклады и ограничен потолком', () => {
    expect(dodgeChance(makeUnit({ bossMechanics: ['stealth'] }))).toBeCloseTo(0.3)
    expect(dodgeChance(makeUnit({ bossMechanics: ['evasion'] }))).toBeCloseTo(0.25)
    expect(dodgeChance(makeUnit({ bossMechanics: ['stealth', 'evasion'] }))).toBeCloseTo(0.55)
    expect(dodgeChance(makeUnit({}))).toBe(0)
  })

  it('при уклонении часть ударов проходит без урона', () => {
    const boss = makeUnit({ id: 'b', side: 'enemy', hp: 100000, maxHp: 100000, bossMechanics: ['stealth'] })
    const st = makeState([boss])
    const ctx = ctxWithResist()
    let dodged = 0
    for (let i = 0; i < 400; i++) {
      const before = boss.hp
      applyDamage(st, boss, 10, 'physical', 'x', ctx)
      if (boss.hp === before) dodged++
    }
    expect(dodged).toBeGreaterThan(60) // ~30% от 400
  })
})

describe('§13.4 enrage_below_half усиливает урон при HP<50%', () => {
  it('исходящий урон множится при низком HP кастера', () => {
    const mk = (hp: number) =>
      makeUnit({
        id: 'b',
        stats: stats({ attack: 10, critChance: 0, health: 30 }),
        hp,
        maxHp: 30,
        bossMechanics: ['enrage_below_half'],
      })
    const rng = new SeededRng(1)
    const full = resolveCardAmount(STRIKE_CARD, 1, mk(30), null, [], rng)
    const low = resolveCardAmount(STRIKE_CARD, 1, mk(10), null, [], rng)
    expect(low.amount).toBe(Math.round(full.amount * BOSS.enrageMult))
  })
})

describe('§13.4 anti_heal ослабляет лечение противников живого босса', () => {
  it('лечение игрока режется, пока жив босс anti_heal; после смерти — полное', () => {
    const player = makeUnit({ id: 'p', side: 'player', hp: 1, maxHp: 500 })
    const boss = makeUnit({ id: 'b', side: 'enemy', hp: 100, maxHp: 100, bossMechanics: ['anti_heal'] })
    const st = makeState([player, boss])
    healUnit(st, player, 100, 'жрец')
    expect(player.hp).toBe(1 + Math.round(100 * BOSS.antiHealFactor)) // 1 + 30

    boss.hp = 0
    player.hp = 1
    healUnit(st, player, 100, 'жрец')
    expect(player.hp).toBe(101)
  })
})

describe('§13.4 self_regen восстанавливает HP в начале хода', () => {
  it('onTurnStart лечит босса на долю maxHp', () => {
    const boss = makeUnit({ id: 'b', side: 'enemy', hp: 50, maxHp: 100, bossMechanics: ['self_regen'] })
    const st = makeState([makeUnit({ id: 'p' }), boss])
    onTurnStart(st, boss)
    expect(boss.hp).toBe(50 + Math.round((100 * BOSS.selfRegenPct) / 100)) // 50 + 8
  })
})

describe('§13.4 reflect возвращает урон атакующему', () => {
  it('базовая атака по боссу-reflect ранит героя', () => {
    const hero = makeUnit({
      id: 'h',
      side: 'player',
      x: 0,
      y: 0,
      stats: stats({ attack: 10, critChance: 0, health: 30 }),
    })
    const boss = makeUnit({
      id: 'b',
      side: 'enemy',
      x: 1,
      y: 0,
      hp: 500,
      maxHp: 500,
      stats: stats({ defense: 0, health: 500 }),
      bossMechanics: ['reflect'],
    })
    const st = makeState([hero, boss])
    const ctx = makeContext([STRIKE_CARD])
    basicAttack(st, 'h', 'b', ctx)
    const dealt = 500 - boss.hp
    expect(dealt).toBeGreaterThan(0)
    expect(hero.hp).toBe(30 - Math.round((dealt * BOSS.reflectPct) / 100))
  })
})

describe('§13.4 first_strike даёт приоритет в очереди', () => {
  it('босс с first_strike ходит раньше при меньшей инициативе', () => {
    const boss = makeUnit({ id: 'b', stats: stats({ initiative: 1 }), bossMechanics: ['first_strike'] })
    const fast = makeUnit({ id: 'f', stats: stats({ initiative: 50 }) })
    expect(computeTurnOrder([fast, boss])[0]).toBe('b')
  })
})

describe('§13.4 summon_minions призывает миньонов один раз', () => {
  it('при HP<50% появляются миньоны рядом, повторно — нет', () => {
    const boss = makeUnit({
      id: 'b',
      side: 'enemy',
      x: 5,
      y: 5,
      hp: 40,
      maxHp: 100,
      bossMechanics: ['summon_minions'],
    })
    const st = makeState([makeUnit({ id: 'p' }), boss])
    onTurnStart(st, boss)
    const after = st.units.length
    expect(after).toBe(2 + BOSS.minionCount)
    expect(boss.summonedMinions).toBe(true)
    onTurnStart(st, boss)
    expect(st.units.length).toBe(after) // одноразово
  })
})

describe('помощники элементальных тегов', () => {
  it('elementTag находит стихию, игнорируя вид', () => {
    expect(elementTag(['aoe', 'skill', 'fire'])).toBe('fire')
    expect(elementTag(['melee', 'attack'])).toBe('physical')
  })
  it('isMagicTag отличает магию от физики', () => {
    expect(isMagicTag('fire')).toBe(true)
    expect(isMagicTag('physical')).toBe(false)
    expect(isMagicTag(undefined)).toBe(false)
    expect(isMagicTag('melee')).toBe(false)
  })
})
