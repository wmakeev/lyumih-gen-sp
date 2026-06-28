# Атлас 1 — `units` (МЕЛКИЕ ТОКЕНЫ поля боя)

**Манифест:** `units` — сетка **6×4 = 24 ячейки**, **16 элементов** (остальные 8 пустые). Холст
ландшафтный **3:2** (например 1536×1024 — нарежется и ужмётся в ячейку 128×128 нормализатором).

**Назначение в игре:** токены юнитов на поле боя и в очереди (**20–44px**), грид ростера. НЕ портреты —
для крупных портретов 96–128px есть отдельный лист `05-portraits.md`. 8 героев + 8 рас врагов.

> **Это «токеновый» лист — оптимизирован под МАЛЕНЬКИЙ размер:** простые крупные формы, светлые тела,
> толстый костяной контур. Стиль/дизайн персонажей держим **в точности как на портретном листе**
> (приложи `portraits` как style-reference), чтобы токен и портрет одного героя не разъезжались.

**Порядок ячеек = порядок `ids` в манифесте** (слева-направо, сверху-вниз):

```
Ряд 1:  1 warrior   2 mage     3 ranger    4 healer    5 rogue     6 paladin
Ряд 2:  7 warlock   8 berserker 9 beast    10 undead   11 human    12 orc
Ряд 3: 13 elf      14 specter  15 construct 16 demon    17 (пусто)  18 (пусто)
Ряд 4: 19–24 (пусто, прозрачные)
```

--- PROMPT START ---

A single sprite atlas sheet, arranged as an exact grid of **6 columns × 4 rows** of equal square
cells, on a **solid flat fully-saturated chroma-green `#00FF00` background** filling the whole
canvas (NOT a checkerboard, NOT a transparency pattern, NOT white — the green will be keyed out to
transparency in code; do not draw real alpha).

ART STYLE: dark gothic **flat vector** character tokens, **bold readable silhouette**, **thick
uniform bone outline**, **no gradients, no 3D, no realistic rendering, no text**. Frontal slightly
3/4 full-body pose, same eye-level camera for all. Memento-mori mood.

READABILITY AT TOKEN SIZE — CRITICAL (these tokens are rendered as small as **40×40 px** on the
battlefield): design every figure to read clearly when shrunk to ~40px.
- **Few large shapes, MINIMAL micro-detail.** No tiny straps, buckles, individual fingers, rivets,
  filigree or busy textures — they turn to mud at 40px. One clear weapon, one clear silhouette read.
- **Fill the cell.** Each character is LARGE in its cell, head near the top edge, feet near the
  bottom, only a small even margin — NOT a tiny figure floating in empty space.
- **Heavy, even bone outline** (#EDE8DD) around the whole silhouette, thick enough to survive
  downscaling — this is what separates the figure from the dark game background.

PALETTE (strict) — LIGHTER than before so figures stand out on a near-black UI:
- bodies in **mid-dark desaturated tones (#322E3C–#4A4452)**, cool grey-violet — clearly lighter
  than the near-black #0E0D12 game background. **Do NOT make bodies near-black**; reserve true black
  only for the thinnest core shadows.
- outline, edge light and bone details in warm bone (#EDE8DD, #C9C2B2).
- **One single accent colour: muted blood crimson #B0302B** (lighter #D7615A) for one signature
  element per character (a glow, a blade edge, eyes, a sigil). Undead/ghosts may use one cold pale
  tone (#6E7E8C). No other hues.

Fill the FIRST 16 cells in reading order (left-to-right, top-to-bottom); leave the remaining 8 cells
empty (just the plain chroma-green background, no figure):

Heroes (heroic, upright silhouettes):
1. WARRIOR — armoured swordsman, broad sword and shield, sturdy stance.
2. MAGE — robed figure with tall pointed hat and a long staff with a crimson tip.
3. RANGER — hooded cloaked archer drawing a longbow.
4. HEALER — gentle robed figure, faint crimson halo, holding a staff.
5. ROGUE — agile crouched hooded figure with two daggers.
6. PALADIN — heavy plate armour, large tower shield with a crimson holy emblem.
7. WARLOCK — cowled horned dark caster holding an open grimoire with a crimson glow.
8. BERSERKER — hulking wild warrior with fur, swinging two axes.

Enemies / races (monstrous, distinct silhouettes):
9. BEAST — feral wolf-like quadruped, hunched, fanged.
10. UNDEAD — gaunt skeleton warrior, exposed bone, hollow crimson eye-sockets.
11. HUMAN — armoured bandit/soldier with a short sword.
12. ORC — bulky tusked brute with a heavy cleaver.
13. ELF — slender elegant figure, long ears, elegant bow.
14. SPECTER — floating tattered wraith, no legs, pale ghostly tone.
15. CONSTRUCT — blocky stone-and-iron golem, heavy angular limbs.
16. DEMON — large winged horned demon with a clawed stance.

LAYOUT RULES (critical for automatic slicing): uniform cell size, every figure centred and **fully
inside its own cell with a clear empty margin (~15% of the cell) of plain green on every side**. **No
part of any figure — weapon, axe, bow, wing, horn, cape, claw — may cross the grid lines into a
neighbouring cell; every figure must be a separate island fully surrounded by green.** No drop shadow
outside the cell. Consistent line weight and palette across all 16. Solid flat chroma-green `#00FF00`
background everywhere behind and between the figures — no checkerboard, no white, no other backdrop.

--- PROMPT END ---
