/**
 * Диагностика раскладки AI-листа перед нарезкой (см. docs/journal.md, грабля
 * «units резал ноги»). AI кладёт спрайты НЕ по равномерной сетке манифеста —
 * равномерное окно молча срезает кромки. Прежде чем доверять сетке, прогони
 * этот инструмент: он детектит фактические полосы контента по хромакею (та же
 * метрика, что у нормализатора: g − max(r,b) ≤ KEY_LO = непрозрачный пиксель)
 * и сверяет их с равномерной сеткой cols×rows.
 *
 * Если полосы пересекают границы сетки или смещены — задавай явные srcBoxes
 * (пересечение X- и Y-полос) либо rowLines в scripts/normalize-atlases.mjs.
 *
 * Запуск:
 *   node scripts/measure-atlas-bands.mjs resources/atlases/01-units-tokens.png 6 4
 *   npm run atlas:bands -- resources/atlases/01-units-tokens.png 6 4
 * (cols/rows опциональны — нужны только для сравнения с равномерной сеткой.)
 */
import sharp from 'sharp'
import { resolve } from 'node:path'

const KEY_LO = 40 // g − max(r,b) ≤ KEY_LO → пиксель считается контентом (не зелёный фон)
const FRAC = 0.02 // порог полосы: доля контентных пикселей в строке/столбце от поперечного размера

const [, , fileArg, colsArg, rowsArg] = process.argv
if (!fileArg) {
  console.error('Использование: node scripts/measure-atlas-bands.mjs <путь-к-png> [cols] [rows]')
  process.exit(1)
}

const file = resolve(process.cwd(), fileArg)
const img = sharp(file)
const { width: W, height: H } = await img.metadata()
const raw = await img.ensureAlpha().raw().toBuffer()

const isContent = (x, y) => {
  const i = (y * W + x) * 4
  return raw[i + 1] - Math.max(raw[i], raw[i + 2]) <= KEY_LO
}

/** Непрерывные полосы вдоль оси, где контента больше порога (гэпы = зелёные коридоры). */
function bands(axisLen, crossLen, count) {
  const th = crossLen * FRAC
  const out = []
  let inBand = false
  let start = 0
  for (let p = 0; p < axisLen; p++) {
    for (var c = 0, q = 0; q < crossLen; q++) if (count(p, q)) c++
    const on = c > th
    if (on && !inBand) { inBand = true; start = p }
    if (!on && inBand) { inBand = false; out.push([start, p - 1]) }
  }
  if (inBand) out.push([start, axisLen - 1])
  return out
}

const xBands = bands(W, H, (x, y) => isContent(x, y))
const yBands = bands(H, W, (y, x) => isContent(x, y))

const uniform = (total, n) => Array.from({ length: n + 1 }, (_, i) => Math.round((i * total) / n))

console.log(`Лист ${fileArg}: ${W}×${H}`)
console.log(`\nX-полосы контента (${xBands.length} колонок):`)
xBands.forEach((b, i) => console.log(`  col ${i}: ${b[0]}–${b[1]} (ширина ${b[1] - b[0] + 1})`))
console.log(`\nY-полосы контента (${yBands.length} рядов):`)
yBands.forEach((b, i) => console.log(`  row ${i}: ${b[0]}–${b[1]} (высота ${b[1] - b[0] + 1})`))

const cols = colsArg && Number(colsArg)
const rows = rowsArg && Number(rowsArg)
if (cols) console.log(`\nРавномерные X-границы (cols=${cols}): ${uniform(W, cols).join(', ')}`)
if (rows) console.log(`Равномерные Y-границы (rows=${rows}): ${uniform(H, rows).join(', ')}`)
if (cols || rows) {
  console.log(
    '\n⚠ Сверь: если полоса пересекает равномерную границу или смещена от ячейки —\n' +
      '  равномерная сетка срежет кромку. Задавай srcBoxes/rowLines в normalize-atlases.mjs.',
  )
}
