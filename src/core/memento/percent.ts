/**
 * Токены `%%` (§16.4) — масштабирование значений умений по уровню L.
 *
 * Грамматика: одна форма на токен — `BASE%%` | `BASE%%CAP` | `BASE%%-P`
 * (CAP>0, P>0). Парсер: regex ^(-?\d+)%%(?:-(\d+)|(\d+))?$
 *
 * Нормативно (§16). Не менять формулы.
 */

export type ParsedPercentToken =
  | { kind: 'plain'; base: number }
  | { kind: 'cap'; base: number; cap: number }
  | { kind: 'neg'; base: number; p: number }

const TOKEN_RE = /^(-?\d+)%%(?:-(\d+)|(\d+))?$/

/**
 * Разбирает токен `%%`. Возвращает null при некорректном токене.
 */
export function parsePercentToken(token: string): ParsedPercentToken | null {
  const m = TOKEN_RE.exec(token)
  if (!m) return null
  const base = Number(m[1])
  const negCap = m[2] // часть после `-` → форма neg
  const posCap = m[3] // часть без `-` → форма cap
  if (negCap !== undefined) {
    const p = Number(negCap)
    if (p <= 0) return null
    return { kind: 'neg', base, p }
  }
  if (posCap !== undefined) {
    const cap = Number(posCap)
    if (cap <= 0) return null
    return { kind: 'cap', base, cap }
  }
  return { kind: 'plain', base }
}

/**
 * Вычисляет значение токена при уровне level (§16.4).
 *  - level < 0 → null
 *  - некорректный токен → null
 *  - plain: base × (1 + 0.01·L)
 *  - cap:   base × (1 + (cap/100)·(min(L,100)/100))   — заморожен при L>100
 *  - neg:   base × (1 − (min(L,100)/100)·(p/200))     — заморожен при L>100
 *
 * Примеры: 40%% → L0=40, L100=80; 40%%50 → 40/60; 40%%-50 → 40/30.
 */
export function resolvePercentValue(level: number, token: string): number | null {
  if (level < 0) return null
  const parsed = parsePercentToken(token)
  if (parsed === null) return null
  const L = level
  switch (parsed.kind) {
    case 'plain':
      return Math.round(parsed.base * (1 + 0.01 * L))
    case 'cap': {
      const t = Math.min(L, 100)
      return Math.round(parsed.base * (1 + (parsed.cap / 100) * (t / 100)))
    }
    case 'neg': {
      const t = Math.min(L, 100)
      return Math.round(parsed.base * (1 - (t / 100) * (parsed.p / 200)))
    }
  }
}
