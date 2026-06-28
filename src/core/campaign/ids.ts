/**
 * Генерация уникальных id инстансов. Монотонный счётчик + префикс.
 * Для детерминированных тестов можно сбросить через resetIdCounter.
 */

let counter = 0

export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter.toString(36)}`
}

export function resetIdCounter(value = 0): void {
  counter = value
}

/** Текущее значение счётчика (для персиста, чтобы не пересекать id). */
export function getIdCounter(): number {
  return counter
}
