import { describe, it, expect } from 'vitest'
import { buildContentRegistry } from '../src/core/content'

const R = buildContentRegistry()

describe('объёмы контента (§17)', () => {
  it('8 классов', () => expect(R.classes.size).toBe(8))
  it('8 рас', () => expect(R.races.size).toBe(8))
  it('15 склонностей', () => expect(R.specializations.size).toBe(15))
  it('27 предметов', () => expect(R.items.size).toBe(27))
  it('3 статических сценария', () => expect(R.scenarios.size).toBe(3))
  it('7 цепочек экспедиций', () => expect(R.expeditions.size).toBe(7))

  it('карты: 25 игровых (вкл. strike) + 16 монстр/босс = 41', () => {
    expect(R.cards.size).toBe(41)
    expect(R.cards.has('strike')).toBe(true)
  })

  it('все 11 CardKind покрыты хотя бы одним шаблоном', () => {
    const kinds = new Set([...R.cards.values()].map((c) => c.kind))
    for (const k of [
      'melee', 'ranged', 'aoe', 'heal', 'regen', 'resurrect',
      'buff', 'debuff', 'dot', 'lifesteal_spell', 'utility',
    ]) {
      expect(kinds.has(k as never)).toBe(true)
    }
  })

  it('пассивы: 32 героя + 10 врагов = 42', () => {
    expect(R.passives.size).toBe(42)
    const enemyPassives = [...R.passives.values()].filter((p) => p.isEnemy)
    expect(enemyPassives.length).toBe(10)
  })

  it('враги: 31 архетип, из них 8 боссов', () => {
    expect(R.enemies.size).toBe(31)
    const bosses = [...R.enemies.values()].filter((e) => e.isBoss)
    expect(bosses.length).toBe(8)
  })

  it('моды: ≥23 активных card/item + 12 passive', () => {
    const activeCardItem = [...R.cardItemMods.values()].filter((m) => m.enabled !== false)
    expect(activeCardItem.length).toBeGreaterThanOrEqual(23)
    expect(R.passiveMods.size).toBe(12)
  })

  it('кодекс: 7 категорий присутствуют', () => {
    const cats = new Set([...R.codex.values()].map((e) => e.category))
    for (const c of ['class', 'affinity', 'item', 'card', 'passive', 'enemy', 'mod']) {
      expect(cats.has(c as never)).toBe(true)
    }
  })
})
