# Атлас 3 — `meta` (оси Memento Mori, группы модов, глифы хаба)

**Манифест:** `meta` — сетка **6×2 = 12 ячеек**, ячейка **96×96**, **10 элементов**
(последние 2 ячейки пустые/прозрачные). Холст ландшафтный **3:1** (например 1152×384). Если модель
плохо держит 3:1 — попроси «6 columns × 2 rows on a wide landscape canvas».

**Назначение:** оси силы Memento (смерть/использование/победа) рядом с прогресс-барами, эмблемы
групп модов в слотах, служебные глифы хаба (золото, мощь мира, сценарий). Это **эмблемы/сигилы** —
чуть «печатнее» обычных иконок, но в том же flat-vector стиле и палитре, что лист `icons`
(консистентность между листами).

**Порядок ячеек = `ids` манифеста:**

```
Ряд 1:  1 axis_victory  2 axis_use     3 axis_death   4 mod_damage   5 mod_survival  6 mod_utility
Ряд 2:  7 mod_defense   8 gold         9 world_power  10 scenario    11 (пусто)      12 (пусто)
```

--- PROMPT START ---

A single emblem atlas sheet, arranged as an exact grid of **6 columns × 2 rows** of equal square
cells, on a **solid flat fully-saturated chroma-green `#00FF00` background** filling the whole wide
landscape canvas (NOT a checkerboard, NOT a transparency pattern, NOT white — the green will be keyed
out to transparency in code; do not draw real alpha).

ART STYLE: **flat vector emblems / sigils**, **bold silhouette**, **thick uniform outline**, single
flat fill, **no gradients, no 3D, no text**. Each emblem is a single clear symbol, **centred in its
cell at the same visual size**, readable at small sizes. Same gothic memento-mori flat-vector
language and line weight as the stats/skills icon set, so the two sheets feel like one family.

PALETTE (strict): emblems in bone/warm light (#EDE8DD, #C9C2B2) on the chroma-green background, with **one
single accent colour: muted blood crimson #B0302B** for emphasis. No other hues.

Fill the first 10 cells in reading order (left-to-right, top-to-bottom); leave the last 2 cells empty
(just the plain chroma-green background):

1. AXIS_VICTORY — a laurel wreath crowning (the axis of victory).
2. AXIS_USE — two arrows forming a cycle / loop (the axis of usage).
3. AXIS_DEATH — a frontal skull (the axis of death — central memento-mori motif).
4. MOD_DAMAGE — crossed swords inside a rounded badge frame (damage mod group).
5. MOD_SURVIVAL — a heart inside a shield (survival mod group).
6. MOD_UTILITY — a wrench/gear inside a rounded badge frame (utility mod group).
7. MOD_DEFENSE — a shield inside a rounded badge frame (defense mod group).
8. GOLD — a small stack of coins.
9. WORLD_POWER — a globe / orb with a crimson core.
10. SCENARIO — a rolled scroll / parchment.

LAYOUT RULES: uniform cell size, equal margins, each emblem centred in its own cell, **no emblem
bleeding into neighbouring cells, no drop shadow outside the cell**, generous empty green padding
around each. Consistent style and palette across all 10. Solid flat chroma-green `#00FF00`
background — no checkerboard, no white.

--- PROMPT END ---
