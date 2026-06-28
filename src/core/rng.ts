/**
 * Инжекция RNG (§16.2: «ядро принимает r параметром»).
 *
 * Нормативные функции Memento чисты и принимают целое r∈[1..100] напрямую.
 * Для оркестрации (lucky-retry §16.3, seeded офферы §16.9, shuffle спавна
 * §6.10) нужен источник случайности с двумя реализациями:
 *  - SeededRng — детерминированный (mulberry32) для тестов и процедурной
 *    генерации по seed;
 *  - MathRng — на Math.random() для рантайма UI.
 */

export interface Rng {
  /** Равномерное вещественное [0, 1). */
  nextFloat(): number
  /** Целое d100: равномерное [1..100] (для бросков Memento). */
  d100(): number
  /** Целое в диапазоне [min, max] включительно. */
  int(min: number, max: number): number
  /** Случайный бросок шанса: true с вероятностью p∈[0..1]. */
  chance(p: number): boolean
  /** Случайный элемент непустого массива. */
  pick<T>(arr: readonly T[]): T
  /** Перестановка Фишера—Йетса (новый массив). */
  shuffle<T>(arr: readonly T[]): T[]
}

abstract class BaseRng implements Rng {
  abstract nextFloat(): number

  d100(): number {
    return Math.floor(this.nextFloat() * 100) + 1
  }

  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min]
    return min + Math.floor(this.nextFloat() * (max - min + 1))
  }

  chance(p: number): boolean {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.nextFloat() < p
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array')
    return arr[this.int(0, arr.length - 1)]!
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out
  }
}

/** Детерминированный PRNG (mulberry32) от 32-битного seed. */
export class SeededRng extends BaseRng {
  private state: number

  constructor(seed: number) {
    super()
    // нормализуем seed в uint32, ненулевой
    this.state = (seed >>> 0) || 0x9e3779b9
  }

  nextFloat(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Недетерминированный RNG поверх Math.random() (рантайм UI). */
export class MathRng extends BaseRng {
  nextFloat(): number {
    return Math.random()
  }
}

/** Удобный фабричный хелпер. */
export function seeded(seed: number): SeededRng {
  return new SeededRng(seed)
}
