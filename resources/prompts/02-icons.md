# Атлас 2 — `icons` (статы, виды карт, слоты экипировки)

**Манифест:** `icons` — сетка **6×4 = 24 ячейки**, ячейка **128×128**, **23 элемента**
(последняя ячейка пустая/прозрачная). Холст ландшафтный **3:2** (например 1536×1024).

**Назначение:** иконки статов 24px (статблок), виды умений 40px (панель действий), слоты
экипировки 48px. Самая плотная служебная информация UI — стиль **flat-vector, максимально читаемый
на ~24px**: один глиф = один смысл, толстый контур, силуэт.

**Порядок ячеек = `ids` манифеста:**

```
Ряд 1:  1 health     2 defense    3 attack     4 magicPower  5 mana       6 healPower
Ряд 2:  7 speed      8 initiative 9 critChance 10 melee      11 ranged    12 aoe
Ряд 3: 13 heal      14 regen     15 resurrect 16 buff       17 debuff    18 dot
Ряд 4: 19 lifesteal_spell  20 utility  21 slot_weapon  22 slot_armor  23 slot_accessory  24 (пусто)
```

--- PROMPT START ---

A single icon atlas sheet, arranged as an exact grid of **6 columns × 4 rows** of equal square
cells, on a **solid flat fully-saturated chroma-green `#00FF00` background** filling the whole
canvas (NOT a checkerboard, NOT a transparency pattern, NOT white — the green will be keyed out to
transparency in code; do not draw real alpha).

ART STYLE: **flat vector game icons**, **bold solid silhouette**, **thick uniform outline**, single
flat fill, **no gradients, no 3D, no text, no number badges**. Each icon is a single clear glyph,
**centred in its cell, the same visual size**, designed to stay readable down to 24px. Gothic
memento-mori game UI set.

PALETTE (strict): glyphs in bone/warm light (#EDE8DD, #C9C2B2) on the chroma-green background, with **one
single accent colour: muted blood crimson #B0302B** for emphasis/fills. No other hues. Consistent
line weight across every icon.

Fill the first 23 cells in reading order (left-to-right, top-to-bottom); leave the last cell empty
(just the plain chroma-green background):

1. HEALTH — a heart.
2. DEFENSE — a shield.
3. ATTACK — two crossed swords.
4. MAGICPOWER — a four-point arcane sparkle / starburst.
5. MANA — a faceted crystal droplet.
6. HEALPOWER — a heart with a small cross inside (healing).
7. SPEED — a winged boot.
8. INITIATIVE — a single lightning bolt.
9. CRITCHANCE — a crosshair / target reticle.
10. MELEE — a single short sword / dagger blade.
11. RANGED — a bow with a nocked arrow.
12. AOE — a radiating burst / explosion star.
13. HEAL — a bold plus / medical cross with a soft crimson glow.
14. REGEN — a sprouting leaf (regeneration over time).
15. RESURRECT — a lit candle with a small flame (revival).
16. BUFF — an upward chevron arrow.
17. DEBUFF — a downward chevron arrow.
18. DOT — a skull with a small drip (poison / damage over time).
19. LIFESTEAL_SPELL — a blood droplet with a small siphon swirl.
20. UTILITY — a wrench / gear.
21. SLOT_WEAPON — a sword icon framed as an equipment slot.
22. SLOT_ARMOR — a breastplate / chest armour piece.
23. SLOT_ACCESSORY — an amulet pendant on a chain.

LAYOUT RULES: uniform cell size, equal margins, each glyph centred in its own cell, **no glyph
bleeding into neighbouring cells, no drop shadow outside the cell**, generous empty green padding
around each. Keep DOT (#18, skull-with-drip = poison) visually distinct from any death/skull emblem
on other sheets. Solid flat chroma-green `#00FF00` background — no checkerboard, no white.

--- PROMPT END ---
