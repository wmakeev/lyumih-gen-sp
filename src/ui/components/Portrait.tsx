/**
 * `<Portrait>` — крупный портрет персонажа/юнита (96–128px) из атласа `portraits`
 * (план §D, манифест `portraits`, промпт 05-portraits.md). Тот же семантический id,
 * что и боевой токен (classId для героев / raceId для врагов), но другой лист под
 * крупный размер. Пока листа нет — `<Sprite>` отдаёт эмодзи-фолбэк инстанса.
 *
 * Оформление — костяная рамка `.mm-portrait` (зеркалит токен `.mm-token`, но
 * прямоугольная под full-body арт). Акцент инстанса даёт фон-подложку.
 */

import { Sprite } from './Sprite'

interface Props {
  /** Семантический id для атласа portraits (classId/raceId). */
  id?: string | undefined
  /** Per-instance эмодзи-аватар (фолбэк до атласа). */
  emoji: string
  /** Акцент инстанса — фон-подложка портрета. */
  accent?: string | undefined
  /** Сторона рамки в px. */
  size?: number
  dimmed?: boolean
  title?: string
}

export function Portrait({ id, emoji, accent, size = 96, dimmed = false, title }: Props) {
  return (
    <span
      title={title}
      className={`mm-portrait${dimmed ? ' mm-portrait--dimmed' : ''}`}
      style={{ width: size, height: size, ...(accent ? { borderColor: accent } : null) }}
    >
      <Sprite id={id} atlas="portraits" fallback={emoji} size={size - 8} />
    </span>
  )
}
