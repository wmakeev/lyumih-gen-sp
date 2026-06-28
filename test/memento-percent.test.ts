import { describe, it, expect } from 'vitest'
import {
  parsePercentToken,
  resolvePercentValue,
} from '../src/core/memento/percent'

describe('parsePercentToken (§16.4)', () => {
  it('plain / cap / neg', () => {
    expect(parsePercentToken('40%%')).toEqual({ kind: 'plain', base: 40 })
    expect(parsePercentToken('40%%50')).toEqual({ kind: 'cap', base: 40, cap: 50 })
    expect(parsePercentToken('40%%-50')).toEqual({ kind: 'neg', base: 40, p: 50 })
  })

  it('отрицательная база', () => {
    expect(parsePercentToken('-10%%')).toEqual({ kind: 'plain', base: -10 })
  })

  it('некорректные токены → null', () => {
    expect(parsePercentToken('40')).toBeNull()
    expect(parsePercentToken('40%')).toBeNull()
    expect(parsePercentToken('abc%%')).toBeNull()
    expect(parsePercentToken('40%%0')).toBeNull() // CAP>0
    expect(parsePercentToken('40%%-0')).toBeNull() // P>0
  })
})

describe('resolvePercentValue (§16.4)', () => {
  it('таблица примеров при L=0 и L=100', () => {
    expect(resolvePercentValue(0, '40%%')).toBe(40)
    expect(resolvePercentValue(100, '40%%')).toBe(80)

    expect(resolvePercentValue(0, '40%%50')).toBe(40)
    expect(resolvePercentValue(100, '40%%50')).toBe(60)

    expect(resolvePercentValue(0, '40%%-50')).toBe(40)
    expect(resolvePercentValue(100, '40%%-50')).toBe(30)
  })

  it('cap и neg заморожены при L>100, plain — нет', () => {
    expect(resolvePercentValue(200, '40%%50')).toBe(60) // == L100
    expect(resolvePercentValue(200, '40%%-50')).toBe(30) // == L100
    expect(resolvePercentValue(200, '40%%')).toBe(120) // plain растёт
  })

  it('level < 0 → null', () => {
    expect(resolvePercentValue(-1, '40%%')).toBeNull()
  })

  it('некорректный токен → null', () => {
    expect(resolvePercentValue(10, 'bad')).toBeNull()
  })
})
