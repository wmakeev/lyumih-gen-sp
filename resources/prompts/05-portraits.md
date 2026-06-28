# Атлас 5 — `portraits` (КРУПНЫЕ детальные портреты)

**Манифест:** `portraits` — сетка **6×4 = 24 ячейки**, ячейка **256×256**, **16 элементов**
(остальные 8 пустые). Холст ландшафтный **3:2** (например 1536×1024). Те же `ids`, что у `units`.

**Назначение:** крупные портреты **96–128px** — деталь героя, карточка таверны, панель активного
юнита. Здесь размер большой → **деталь уместна и желанна** (в отличие от токенового листа `01`).

> **Текущий `resources/atlases/units_0f0.png` уже годится как этот лист** — это детальный full-body
> арт в нужном стиле. Его достаточно прогнать через нормализатор (вырез `#00FF00` → нарезка → trim →
> ресайз в 256). Промпт ниже — на случай перегенерации/догенерации в том же стиле.

**Порядок ячеек = `ids` манифеста** (идентичен `units`):

```
Ряд 1:  1 warrior   2 mage      3 ranger     4 healer    5 rogue     6 paladin
Ряд 2:  7 warlock   8 berserker 9 beast     10 undead   11 human    12 orc
Ряд 3: 13 elf      14 specter  15 construct 16 demon    17 (пусто)  18 (пусто)
Ряд 4: 19–24 (пусто)
```

--- PROMPT START ---

A single character-portrait atlas sheet, arranged as an exact grid of **6 columns × 4 rows** of equal
square cells, on a **solid flat fully-saturated chroma-green `#00FF00` background** filling the whole
canvas (NOT a checkerboard, NOT a transparency pattern, NOT white — the green is keyed out in code; do
not draw real alpha).

ART STYLE: dark gothic **flat vector** character art, **bold readable silhouette**, **thick uniform
bone outline**, **no gradients, no 3D, no realistic rendering, no text**. Frontal slightly 3/4
full-body pose, same eye-level camera for all. These are large portraits (shown at 96–128px), so
**moderate detail is welcome** — armour plates, cloth folds, weapon shapes — but keep the silhouette
clean and the palette flat. Memento-mori mood.

PALETTE (strict): bodies in deep desaturated grey-violet darks (#17151E–#322E3C), warm bone for
outline, edge light and highlights (#EDE8DD, #C9C2B2). **One single accent colour: muted blood crimson
#B0302B** (lighter #D7615A) for one signature element per character. Undead/ghosts may use one cold
pale tone (#6E7E8C). No other hues.

Fill the FIRST 16 cells in reading order (left-to-right, top-to-bottom); leave the remaining 8 cells
empty (plain chroma-green background):

Heroes: 1. WARRIOR — armoured swordsman, sword + shield. 2. MAGE — robed figure, pointed hat, staff.
3. RANGER — hooded cloaked archer with a longbow. 4. HEALER — gentle robed figure with a faint crimson
halo and staff. 5. ROGUE — agile hooded figure with two daggers. 6. PALADIN — heavy plate, large tower
shield with a crimson emblem. 7. WARLOCK — cowled horned caster with a glowing grimoire. 8. BERSERKER —
hulking fur-clad warrior with two axes.
Enemies: 9. BEAST — feral wolf-like quadruped. 10. UNDEAD — gaunt skeleton warrior. 11. HUMAN —
armoured bandit/soldier. 12. ORC — bulky tusked brute with a cleaver. 13. ELF — slender long-eared
archer. 14. SPECTER — floating tattered pale wraith. 15. CONSTRUCT — blocky stone-and-iron golem.
16. DEMON — large winged horned demon.

LAYOUT RULES: uniform cell size, each figure **fully inside its own cell with a clear empty margin on
every side** — **no part of any figure (weapon, wing, horn, cape) may cross into a neighbouring cell**.
No drop shadow outside the cell. Plain chroma-green fills every gap and every empty cell. Consistent
line weight and palette across all 16.

--- PROMPT END ---
