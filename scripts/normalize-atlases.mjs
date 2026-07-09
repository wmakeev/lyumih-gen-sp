/**
 * Нормализатор спрайт-атласов (этап E плана редизайна).
 *
 * Вход — AI-листы из `resources/atlases/*.png` со СПЛОШНЫМ хромакей-зелёным фоном
 * (`~#00FF00`; ChatGPT не экспортирует alpha — см. `docs/assets.md`).
 * Тонкие белые линии сетки на границах ячеек обходим inset-обрезкой.
 *
 * Конвейер на каждую ячейку:
 *   extract по сетке `atlas-manifest.json` (+inset чтобы срезать линии)
 *   → хромакей-вырез зелёного в alpha (метрика g-max(r,b)) + despill кромки
 *   → [sprite-режим] alpha-trim bbox → contain в (cell-2·pad) → центрирование в ячейку
 *   → [tile-режим]  resize fill в ячейку (тайлы полноразмерные, без трима)
 *   → композ в чистый лист cols·cellW × rows·cellH с прозрачным фоном.
 *
 * Выход — `public/atlases/<name>.png` (Vite раздаёт как `/atlases/<name>.png`).
 * Затем проставляет `src` в манифест. Идемпотентно: можно гонять повторно.
 *
 * Запуск: `node scripts/normalize-atlases.mjs`
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = resolve(ROOT, 'src/ui/assets/atlas-manifest.json')
const OUT_DIR = resolve(ROOT, 'public/atlases')

// Привязка атласа → исходный лист и параметры нарезки.
// inset — px, срезаемые с каждой стороны ячейки сетки (убирает белые линии сетки).
// pad   — px-«поля» вокруг спрайта в выходной ячейке (дыхание; только fit:'contain').
// trim  — alpha-trim bbox перед вписыванием (true для всех — убирает зелёные поля).
// fit   — 'contain' (центрирование+pad, сохраняет пропорции) | 'fill' (растянуть в
//         ячейку; для тайлов/оверлеев, которые должны заполнять клетку целиком).
// srcBoxes — явные исходные окна {left,top,width,height} вместо сетки манифеста.
//         Нужны для tiles: 7 фигур разложены неравномерно (не по 8-кол. сетке) и
//         часть полые (рамка/уголки) — авто-сетка их режет. Боксы измерены детекцией
//         контента по 04-tiles.png; ПЕРЕИЗМЕРИТЬ при перегенерации листа тайлов.
// rowLines — фактические y-границы рядов листа (длина rows+1), если сетка НЕ
//         равномерная. AI-лист может печатать ряды неравномерно/со сдвигом
//         (portraits: линии на 0/272/523/766/1023, а не 256/512/768) — тогда
//         линия ряда течёт в окно и режется низ фигуры. С rowLines ряды берутся
//         по этим линиям (колонки остаются равномерными), клип строк — rowInset.
// rowInset — px, срезаемые сверху/снизу от линии ряда (убирают саму линию сетки).
const T = { top: 40, height: 250 } // общая y-полоса ряда тайлов
const SOURCES = {
  units:     { file: '01-units-tokens.png', inset: 10, pad: 12, trim: true, fit: 'contain' },
  icons:     { file: '02-icons.png',        inset: 12, pad: 14, trim: true, fit: 'contain' },
  meta:      { file: '03-meta.png',         inset: 14, pad: 10, trim: true, fit: 'contain' },
  portraits: { file: '05-portraits.png',    inset: 10, pad: 18, trim: true, fit: 'contain',
               rowLines: [0, 272, 523, 766, 1023], rowInset: 4 },
  tiles: {
    file: '04-tiles.png', trim: true, fit: 'fill', pad: 0,
    srcBoxes: [
      { left: 38,   width: 244, ...T }, // floor
      { left: 290,  width: 244, ...T }, // wall
      { left: 544,  width: 244, ...T }, // spawn
      { left: 796,  width: 222, ...T }, // hl_move
      { left: 1026, width: 234, ...T }, // hl_range
      { left: 1274, width: 214, ...T }, // hl_los
      { left: 1514, width: 220, ...T }, // hl_target
    ],
  },
}

// Хромакей-порог по метрике m = g - max(r,b): m<=LO — непрозрачный, m>=HI — вырез.
const KEY_LO = 40
const KEY_HI = 110
const TRIM_ALPHA = 16 // порог alpha для расчёта bbox при триме

/** Хромакей-вырез зелёного: возвращает RGBA-буфер той же геометрии. */
function chromaKey(data, w, h) {
  const out = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const m = g - Math.max(r, b)
    let a
    if (m <= KEY_LO) a = 255
    else if (m >= KEY_HI) a = 0
    else a = Math.round(255 * (KEY_HI - m) / (KEY_HI - KEY_LO))
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = a
    // Despill зелёной кромки на полупрозрачных пикселях.
    if (a > 0 && a < 255) out[i * 4 + 1] = Math.min(g, Math.max(r, b) + 10)
  }
  return out
}

/** bbox непрозрачной области (alpha > TRIM_ALPHA) или null, если пусто. */
function alphaBBox(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > TRIM_ALPHA) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
    }
  return x1 < x0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

async function processAtlas(name, def) {
  const cfg = SOURCES[name]
  if (!cfg) throw new Error(`Нет конфигурации источника для атласа "${name}"`)
  const { cellW, cellH, cols, rows, ids } = def
  const src = sharp(resolve(ROOT, 'resources/atlases', cfg.file))
  const meta = await src.metadata()
  const { width: W, height: H } = meta
  const raw = await src.ensureAlpha().raw().toBuffer()

  // Граница ячейки col по дробной сетке (источник может не делиться нацело).
  const bound = (i, total, n) => Math.round((i * total) / n)

  const layers = []
  for (let idx = 0; idx < ids.length; idx++) {
    // Исходное окно: явный бокс (tiles) либо ячейка сетки манифеста (+inset).
    let left, top, cw, ch
    if (cfg.srcBoxes) {
      const b = cfg.srcBoxes[idx]
      if (!b) continue
      ;({ left, top, width: cw, height: ch } = b)
    } else {
      const col = idx % cols, row = Math.floor(idx / cols)
      const cx0 = bound(col, W, cols), cx1 = bound(col + 1, W, cols)
      // Ряды: по фактическим линиям сетки листа (rowLines), если заданы, иначе
      // равномерная сетка манифеста. rowInset клипает саму линию ряда.
      const cy0 = cfg.rowLines ? cfg.rowLines[row] : bound(row, H, rows)
      const cy1 = cfg.rowLines ? cfg.rowLines[row + 1] : bound(row + 1, H, rows)
      const rIn = cfg.rowLines ? cfg.rowInset : cfg.inset
      left = cx0 + cfg.inset; top = cy0 + rIn
      cw = cx1 - cx0 - 2 * cfg.inset; ch = cy1 - cy0 - 2 * rIn
    }
    // Клампим окно в границы листа.
    cw = Math.min(cw, W - left); ch = Math.min(ch, H - top)

    // Вырезаем окно из общего raw-буфера.
    const cell = Buffer.alloc(cw * ch * 4)
    for (let y = 0; y < ch; y++)
      raw.copy(cell, y * cw * 4, ((top + y) * W + left) * 4, ((top + y) * W + left + cw) * 4)

    const keyed = chromaKey(cell, cw, ch)

    // alpha-trim → bbox содержимого (убирает зелёные/прозрачные поля).
    const bb = cfg.trim ? alphaBBox(keyed, cw, ch) : { left: 0, top: 0, width: cw, height: ch }
    if (!bb) continue // пустое окно — пропускаем
    const trimmed = await sharp(keyed, { raw: { width: cw, height: ch, channels: 4 } })
      .extract(bb)
      .toBuffer()
    const tImg = sharp(trimmed, { raw: { width: bb.width, height: bb.height, channels: 4 } })

    let cellImg
    if (cfg.fit === 'fill') {
      // Растягиваем содержимое на всю ячейку (оверлеи/тайлы).
      cellImg = await tImg.resize(cellW, cellH, { fit: 'fill' }).png().toBuffer()
    } else {
      // Вписываем с сохранением пропорций и полем pad, центрируем в ячейке.
      cellImg = await tImg
        .resize(cellW - 2 * cfg.pad, cellH - 2 * cfg.pad, { fit: 'contain', background: TRANSPARENT })
        .extend({ top: cfg.pad, bottom: cfg.pad, left: cfg.pad, right: cfg.pad, background: TRANSPARENT })
        .png()
        .toBuffer()
    }
    const outCol = idx % cols, outRow = Math.floor(idx / cols)
    layers.push({ input: cellImg, left: outCol * cellW, top: outRow * cellH })
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = resolve(OUT_DIR, `${name}.png`)
  await sharp({ create: { width: cols * cellW, height: rows * cellH, channels: 4, background: TRANSPARENT } })
    .composite(layers)
    .png()
    .toFile(outPath)
  return { name, out: `/atlases/${name}.png`, cells: layers.length, dim: `${cols * cellW}x${rows * cellH}` }
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
for (const [name, def] of Object.entries(manifest.atlases)) {
  const r = await processAtlas(name, def)
  def.src = r.out
  console.log(`✓ ${r.name.padEnd(10)} ${r.dim.padEnd(11)} ${r.cells} ячеек → ${r.out}`)
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
console.log('✓ manifest src проставлены')
