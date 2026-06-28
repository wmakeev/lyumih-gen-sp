/**
 * `<Sprite>` — единая обёртка-плейсхолдер «эмодзи → спрайт» (план §D1/§7.5).
 *
 * Пока для (atlas,id) нет нарезанного листа (`src=null` в манифесте), рендерит
 * фолбэк-эмодзи в контейнере ТОЧНОГО целевого размера (фикс aspect-ratio) — так
 * вёрстка не поедет при замене. Когда атлас появится (этап E), тот же компонент
 * начнёт рендерить `background: url(src) -X -Y` — переключение одноточечное.
 *
 * Источник отображения — UI-реестр (`icon-registry`), НЕ поля core. Для
 * per-instance аватаров эмодзи передаётся явно через `fallback`.
 */

import manifest from '../assets/atlas-manifest.json'
import { ICONS } from '../assets/icon-registry'

interface AtlasDef {
  src: string | null
  cellW: number
  cellH: number
  cols: number
  rows: number
  ids: string[]
}

const ATLASES = manifest.atlases as Record<string, AtlasDef>

export interface SpriteProps {
  /** Семантический id (statId, kind, classId…). */
  id?: string
  /** Явный атлас; по умолчанию берётся из реестра по id. */
  atlas?: string
  /** Сторона ячейки в px (фикс aspect-ratio 1:1). */
  size?: number
  /** Явный фолбэк-эмодзи (для per-instance аватаров). Приоритетнее реестра. */
  fallback?: string
  /** Цвет-акцент фона (иначе прозрачный). */
  accent?: string | undefined
  dimmed?: boolean
  title?: string
  className?: string
}

export function Sprite({
  id,
  atlas,
  size = 32,
  fallback,
  accent,
  dimmed = false,
  title,
  className,
}: SpriteProps) {
  const reg = id ? ICONS[id] : undefined
  const atlasId = atlas ?? reg?.atlas
  const def = atlasId ? ATLASES[atlasId] : undefined

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flex: '0 0 auto',
    lineHeight: 1,
    userSelect: 'none',
    ...(accent ? { background: accent } : null),
    filter: dimmed ? 'grayscale(1) opacity(0.5)' : undefined,
  }

  // Нарезанный атлас доступен → рендерим срез.
  if (def && def.src && id && def.ids.includes(id)) {
    const idx = def.ids.indexOf(id)
    const col = idx % def.cols
    const row = Math.floor(idx / def.cols)
    const scaleX = size / def.cellW
    const scaleY = size / def.cellH
    return (
      <span
        className={className}
        title={title}
        style={{
          ...base,
          backgroundImage: `url(${def.src})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `-${col * def.cellW * scaleX}px -${row * def.cellH * scaleY}px`,
          backgroundSize: `${def.cols * def.cellW * scaleX}px ${def.rows * def.cellH * scaleY}px`,
        }}
      />
    )
  }

  // Фолбэк-эмодзи в контейнере точного размера.
  const emoji = fallback ?? reg?.emoji ?? '❓'
  return (
    <span
      className={className}
      title={title}
      data-sprite={id ?? atlasId}
      style={{ ...base, fontSize: Math.round(size * 0.62) }}
    >
      {emoji}
    </span>
  )
}
