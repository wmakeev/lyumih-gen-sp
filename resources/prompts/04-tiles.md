# Атлас 4 — `tiles` (тайлы поля боя + подсветки-оверлеи)

**Манифест:** `tiles` — сетка **8×4 = 32 ячейки**, ячейка **64×64**, **7 элементов**
(остальные пустые/прозрачные). Холст **2:1** (например 1024×512) или квадрат — режется по сетке.

**Особая логика листа (отчёт §5.1):** первые 3 тайла (пол/стена/спавн) — **непрозрачные**,
заполняют ячейку целиком (тайлится на поле). Остальные 4 — **полупрозрачные оверлеи-подсветки** на
прозрачном фоне, накладываются поверх тайла. Это нормально для одного листа.

**Критично (план B2, дальтонизм):** подсветки должны различаться **паттерном/обводкой/маркером, а не
только цветом** — каждая своя форма заливки.

**Порядок ячеек = `ids` манифеста:**

```
Ряд 1:  1 floor   2 wall   3 spawn   4 hl_move   5 hl_range   6 hl_los   7 hl_target   8 (пусто)
Ряды 2–4: пусто (прозрачные)
```

--- PROMPT START ---

A single top-down tactical-grid tile atlas, arranged as an exact grid of **8 columns × 4 rows** of
equal square cells, on a **solid flat fully-saturated chroma-green `#00FF00` background** (NOT a
checkerboard, NOT a transparency pattern, NOT white — the green will be keyed out in code; do not
draw real alpha). Fill only the first 7 cells of the top row in reading order; leave every other cell
as the plain chroma-green background.

ART STYLE: dark gothic **flat** top-down game tiles, **bold shapes, thick outline, no gradients, no
3D, no text**, muted memento-mori mood. Each tile fills a single square cell, seen straight from
above. Cells 1–3 are **solid opaque square tiles** (they tile across a battlefield, no green showing).
Cells 4–7 are **highlight overlay markers** meant to be laid on top of a tile — drawn as **solid
opaque shapes on the green background** (do NOT make them semi-transparent — partial opacity is added
later in code; here just draw a clear solid marker). Each overlay must have a clearly DIFFERENT shape,
so they are distinguishable WITHOUT relying on colour (colour-blind safe).

PALETTE (strict): stone tiles in deep near-black with violet undertone (#0E0D12, #17151E) and bone
edges (#C9C2B2). **One accent colour: muted blood crimson #B0302B** (lighter #D7615A). One cold pale
tone (#6E7E8C) allowed for one overlay only.

1. FLOOR — an opaque dark stone floor tile, subtle cracks, seamless/tileable, top-down.
2. WALL — an opaque solid stone wall block, heavier and lighter than the floor, top-down.
3. SPAWN — an opaque floor tile with a glowing crimson summoning rune carved in the centre.
4. HL_MOVE — a movement-range overlay: a **solid flat FILL** of the whole cell (no border emphasis),
   cold pale tone #6E7E8C.
5. HL_RANGE — an attack-range overlay: **only a bold OUTLINED border** hugging the cell edge, crimson,
   with the cell interior left as plain green (so it keys to transparent inside the frame).
6. HL_LOS — a line-of-sight overlay: **a diagonal hatched / striped pattern** filling the cell,
   bone-coloured, clearly different from the others.
7. HL_TARGET — a target marker: **a corner-bracket reticle frame** (four L-shaped corners) with a
   small centre crosshair, bright crimson #D7615A.

LAYOUT RULES: uniform 64-style cell proportion, each tile/overlay centred and filling its cell
consistently, **no bleeding into neighbouring cells, no drop shadow outside the cell**. The four
overlays (4–7) must read as four distinct PATTERNS (solid fill / outlined border / hatched stripes /
corner reticle), not just four colours. Plain chroma-green `#00FF00` fills every empty area and every
gap inside the overlay markers; only the opaque tiles 1–3 cover their whole cell.

--- PROMPT END ---
