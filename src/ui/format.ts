/** Чисто презентационные форматтеры UI (без доменной логики). */

/**
 * Процент прогресса [0..100] для баров: округление и клэмп сверху; при
 * непозитивном максимуме — 0. Презентационная величина (напр. оси Memento).
 */
export function pct(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((value / max) * 100))
}
