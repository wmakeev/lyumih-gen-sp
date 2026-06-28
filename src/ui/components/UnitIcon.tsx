/**
 * Аватар-токен юнита/персонажа. Глиф рендерится через <Sprite atlas="units">:
 * пока атласа нет — фолбэк-эмодзи инстанса; форма/акцент токена — из токенов темы
 * (`.mm-token`). Когда лист units появится (этап E), переключение одноточечное.
 */

import { Sprite } from './Sprite'

interface Props {
  /** Per-instance эмодзи-аватар (фолбэк до атласа). */
  emoji: string
  /** Семантический id для атласа units (classId/raceId). Опционально. */
  id?: string
  /** Переопределение фона-акцента (по умолчанию — токен темы). */
  accent?: string | undefined
  size?: number
  dimmed?: boolean
  title?: string
}

export function UnitIcon({ emoji, id, accent, size = 40, dimmed = false, title }: Props) {
  return (
    <span
      title={title}
      className={`mm-token${dimmed ? ' mm-token--dimmed' : ''}`}
      style={{ width: size, height: size, ...(accent ? { background: accent } : null) }}
    >
      <Sprite id={id} atlas="units" fallback={emoji} size={size - 4} />
    </span>
  )
}
