# PROGRESS — реализация Gen

Состояние работы на диске (переживает суммаризацию контекста). Источник истины — `gen_spec_for_claude.md`.

## Решения (зафиксированы)

- **Стек:** React 19 + Ant Design 6 + Zustand 5 + Vite 6 + Vitest 3. Node 24.
- **Профиль баланса:** дефолт `development` (вехи 5/5, дроп 10%, магазин 50%); `production` (75/100, 1%, 3%) включается `VITE_GAME_PROFILE=production` или `setProfile()`. Тесты §18.4 — на production.
- **Алиасы путей:** `@core/*`, `@state/*`, `@ui/*`.
- **Балансовые формулы боя** (вне scope спеки §0 — наша зона свободы, линейная модель). Будут в `docs/balance.md` на Этапе 2:
  - урон = `skillFlat + resolvePercentValue(L, token) + statBonus`, где `statBonus = round(statSource * K)` (K подберём, по умолчанию 1.0 для прямого вклада);
  - защита: `dmg' = max(1, dmg - defense)` (плоское вычитание, минимум 1);
  - крит: при срабатывании `critChance%` урон ×1.5;
  - speed = клетки перемещения за ход; initiative = ключ сортировки очереди (убывание), тай-брейк по `unitId`.

## Этапы

### ✅ Этап 1 — Ядро + Memento (DONE)
Гейт пройден: `vitest run` = 37 ✓, `tsc --noEmit` чисто.

Файлы ядра:
- `src/core/config.ts` — профили dev/prod, лимиты §4.3, константы.
- `src/core/rng.ts` — инжекция RNG: `SeededRng` (mulberry32, детерминизм), `MathRng`.
- `src/core/types/memento.ts` — типы носителей/слотов/модов (§16.8, 16.11, 16.13).
- `src/core/memento/levels.ts` — `rollCardLevelUp`/`rollMementoLevelUp` (§16.2), `applyCardUse` (§16.3), `applyPassiveProc`, `applyItemLevelUp`, lucky-retry (§16.15).
- `src/core/memento/percent.ts` — `parsePercentToken`/`resolvePercentValue` (§16.4).
- `src/core/memento/slots.ts` — `milestoneThreshold`/`unlockedSlotCount`/`generateOffer`/`syncModSlotsForLevel`/`pickMod`/`removeMod` (§16.8–16.9.1).
- `src/core/memento/mods.ts` — `collectModEffects`/`scaleByLm`/`rollProcExtraHits`/`applyDamageMult` (§16.10–16.12).
- `src/core/memento/victory.ts` — броски победы/смерти (§16.6–16.7).

Тесты (`test/memento-*.test.ts`) покрывают весь чеклист §16.16.

### ✅ Этап 2 — Боевая система (DONE)
Гейт пройден: `vitest run` = 56 ✓, `tsc --noEmit` чисто. Балансовая модель → `docs/balance.md`.

Файлы:
- `src/core/types/stats.ts` — 9 статов (§5.1), effective stats (§5.2).
- `src/core/types/cards.ts` — 11 CardKind (§6.5), StatusEffectSpec, CardTemplate.
- `src/core/types/battle.ts` — BattleState/Unit/Card/Field/Log.
- `src/core/battle/geometry.ts` — манхэттен, LoS (Bresenham), reachableCells (BFS).
- `src/core/battle/queue.ts` — очередь по initiative, downed-исключение, тай-брейк по id.
- `src/core/battle/damage.ts` — величина умения, крит, защита, mod-pipeline (§16.12).
- `src/core/battle/engine.ts` — раунды, move, basicAttack, useCard (урон/heal/aoe/status/lifesteal/resurrect/проки), downed, worldPower (enemyKills), исход.
- `src/core/battle/ai.ts` — AI врагов (skillPriorities) + авто-бой героя (greedy, max-dmg).

Тесты: `battle-geometry/engine/ai`. Покрыты §18.2 пункты (сетка, манхэттен, LoS, очередь, downed, worldPower+1, cooldown, исход).

Осталось на стык с Этапом 3 (требует контента/сценариев):
- spawn-логика (§6.10): зоны, shuffle, excluded — в модуле сценариев.
- авто-бой задержка 2000ms — UI-слой (флаг сессии).
- резисты рас (§13.3) — `ctx.resist`.

### 🔄 Этап 3 — Мета, UI, контент (В РАБОТЕ)

**Контент §17 (DONE)** — `src/core/content/` (11 файлов, субагент): 8 классов, 41 карта (25 игрок+16 монстр/босс, все 11 CardKind), 42 пассива (32+10), 8 рас, 27 предметов, 29 модов карт/предметов (23 активных)+12 модов пассивов, 15 склонностей, 31 враг (8 боссов), 3 сценария, 7 экспедиций, 198 записей кодекса. Ссылочная целостность проверена. `buildContentRegistry()`.

**Мета-слой кампании (DONE)** — `src/core/campaign/`:
- instances/ids/factory/rolls — создание персонажей, найм, стартовый герой, roll статов (§5.3, §10).
- spawn — персонаж→боевой юнит + враги со scaling (§5.2, §13.2).
- specs — интерпретация 15 склонностей (lucky/meta/slot/mod, §11).
- finalize — броски победы/смерти §16.6–16.7, синк прогресса, дроп, worldPower, золото.
- chest/equipment/shop/tavern — §8.5, §9, §10.
- generators — 5 процедурных генераторов (§12.4).
- expedition — старт/retry/abandon/inter-battle/finish, snapshot анти-дюп (§12, §15).
- newgame/persistence — init, localStorage envelope + migrate (§15).
- Стор `src/state/store.ts` (Zustand) — единый campaign + UI-флаги сессии, все экшены.

Тесты: content-counts (12), integration-campaign (сквозной цикл + retry), campaign-meta (таверна/магазин/сундук/persistence). **Итого 75 тестов зелёные**, `tsc --noEmit` чист.

**UI (DONE)** — `src/ui/` (React 19 + AntD 6, субагент): App-роутер по фазе, HubScreen (6 вкладок: Бой/Экспедиция, Персонаж, Магазин, Таверна, Кодекс, Справка), BattleScreen (сетка/очередь/действия/лог/оверлеи), InterBattleScreen, StatStrip/UnitIcon. `index.html` + `main.tsx` (ConfigProvider ruRU).

**Playwright smoke-тест (DONE)** — живой прогон подтвердил сквозной цикл:
новая игра → экспедиция (дуэль) → бой → **Победа** → финализация (золото +50, worldPower 0→1, scenarioIndex 0→1) → хаб; плюс Поражение → retry (восстановление снимка) и abandon (золото восстановлено, анти-дюп); перезагрузка с автосейвом восстановила бой; все 6 вкладок рендерятся.

**Найдено и исправлено при верификации:**
1. Авто-бой не само-прогрессировал: эффект зависел от стабильной ссылки `campaign` (стор мутирует на месте) → завязал на `rev`. (`src/ui/BattleScreen.tsx`)
2. Ранний баланс: враги контента переутяжелены, отряд-одиночка непроходим → `ENEMY_POWER_SCALE=0.5`/`BOSS_POWER_SCALE=0.7` в `spawn.ts` (документировано в `docs/balance.md`).

Консоль: только безобидные deprecation-предупреждения AntD (Space `direction`, List) + favicon 404.

### ✅ Этап 3 — ЗАВЕРШЁН. Итог: 75 тестов зелёные, `tsc` чист, `vite build` успешна, живой smoke пройден.

### 🔄 Редизайн «Memento Mori» (по `redesign-plan.md`, опора — `game-deep-research/report.md`)

Инвариант соблюдён: ядро (`core/battle|memento|campaign`) не тронуто, правки только в `src/ui` (+ vite.config, deprecated-комментарий в `core/types/stats.ts`). После каждого этапа: 75 тестов зелёные, `tsc` чист, `vite build` ок.

- **✅ Этап A — Тема AntD.** `src/ui/theme.ts` (`gameTheme`: dark+compact алгоритмы, акцент `#B0302B`, фон `#0E0D12`, радиус 4, component tokens Card/Tooltip/Button/Tabs/Tag/Progress). `src/ui/theme.css` — семантический слой на `--ant-color-*` (поверхности, стороны боя, подсветки, формы токенов). Шрифты self-host: `@fontsource-variable/inter` (корпус, кириллица), `@fontsource/forum` (заголовки `.mm-display`). `main.tsx` → `gameTheme`. Хардкод-цвета убраны из `UnitIcon`. Deprecations: `Space direction`→`orientation` (15 точек, сверено с migration-v6 через Context7); favicon + тёмный html-фон. Остаётся `List` deprecated (CodexTab/PersonaTab — рабочий, заменить при случае).
- **✅ Этап B — UX боя.** `src/ui/battle-preview.ts` — чистое превью исхода (зеркалит движок, без мутаций, фикс-RNG для крита). `BattleScreen.tsx`: превью урона/лечения над целью + зона AoE на наведении (B1); сетка кодируется паттерном/обводкой+формой токена (круг=свой/квадрат=враг), downed=grayscale+✕ (B2); лента очереди с бейджами порядка + панель действий фикс-размеров с КД-бейджами (B3). Визуально подтверждено.
- **✅ Этап C — Memento-панель.** Новая вкладка `MementoTab.tsx` (`memento` в `HubTab`): оси силы (Победа/Использование/Стойкость) прогресс-барами (C1) + носители со слотами модов (filled=иконка группы+«M+»+lm / empty=пунктир) (C2). Презентационная — слоты наполняет ядро при победах.
- **✅ Этап D — слой Sprite.** `components/Sprite.tsx` (фолбэк-эмодзи в контейнере точного размера; при появлении атласа — `background-position`). `assets/icon-registry.ts` — UI-источник истины для статических id (статы, CardKind, слоты, оси/группы, глифы). `assets/atlas-manifest.json` — манифест (units/icons/meta/tiles, `src:null`). Мигрированы: StatStrip, UnitIcon, боевые токены, Memento-иконки. `STAT_META.emoji` помечен legacy (UI не опирается). Per-instance аватары остаются фолбэком (динамические).
- **✅ Этап F — доступность/перф.** Контраст палитры посчитан — все пары WCAG AA (текст ≥4.5, иконки/крупное ≥3); подпись активной вкладки осветлена до `#D7615A` (5.3:1). Дальтонизм закрыт структурно (формы/паттерны). Бандл разбит: app 152 КБ + `vendor-antd` 752 КБ отдельным кэш-чанком; не деградировал.
- **✅ Этап E — генерация атласов (DONE).** 5 листов сгенерированы в ChatGPT с хромакей-зелёным фоном (`resources/atlases/0X-*.png`). Нормализатор `scripts/normalize-atlases.mjs` (sharp, `npm run atlases`): вырез зелёного по метрике `g-max(r,b)` + despill → alpha-trim bbox → вписывание в ячейку (contain+pad для спрайтов / fill для тайлов-оверлеев) → чистый лист `cols·cellW × rows·cellH` с alpha. Линии сетки обходятся inset-обрезкой; tiles разложены неравномерно → явные `srcBoxes` (переизмерить при перегенерации). Выход → `public/atlases/*.png` (Vite: `/atlases/<name>.png`), `src` проставлены в манифест. Живой smoke: стат-иконки/экипировка = `icons`, боевые токены = `units` (маппинг id→ячейка верный), фон чистый, костяной контур читается. Гейт: 75 тестов ✓, `tsc` чист, `vite build` ок (атласы в `dist/atlases/`). Тайлы поля по-прежнему CSS-паттерны (этап B, дальтонизм) — атлас `tiles` доступен, но полем не используется.

- **✅ Портреты в UI (DONE, 2026-06-28).** Атлас `portraits` подключён через новый `components/Portrait.tsx`
  (крупная костяная рамка `.mm-portrait`, спрайт по тому же id, что и боевой токен: classId героя / raceId врага,
  эмодзи-фолбэк инстанса). Встроен в 3 точки: карточка персонажа (`PersonaTab`, 104px), кандидаты таверны
  (`TavernTab`, 72px), активная панель боя (`BattleScreen`, 72px). **ВАЖНО:** фон рамки — тёмная ниша
  (градиент surface→bg), акцент инстанса даётся ТОЛЬКО цветом рамки; заливать весь фон акцентом нельзя —
  просвечивает сквозь прозрачный фон спрайта = цветной ящик (отловлено живым smoke). Гейт: 75 тестов ✓, `tsc`
  чист, `vite build` ок. Живой Playwright-smoke подтвердил рендер из `portraits.png` (не фолбэк) во всех 3 точках.

- **✅ Тайлы поля боя в UI (DONE, 2026-06-28).** Атлас `tiles` (floor/wall) подключён фоном клетки в
  `BattleScreen.tsx` (`BattleGrid`). Логика нарезки вынесена из `<Sprite>` в общий экспорт
  `atlasSlice(atlas, id, size)` (`components/Sprite.tsx`); клетка получает инлайн `backgroundImage`-срез тайла,
  CSS-цвета (`--mm-cell`/`--mm-wall`) остаются фолбэком. **z-порядок:** фон тайла занял `background` клетки →
  подсветки move/zone, рисовавшиеся через `background`, переведены в оверлей `::after` (inset:0,
  pointer-events:none) ПОВЕРХ тайла; токену дан `.mm-unit { z-index:1 }`, чтобы оверлей не лёг на него.
  target/active остались на `box-shadow`. Гейт: 75 тестов ✓, `tsc` чист, `vite build` ок. Живой Playwright-smoke
  в бою подтвердил рендер floor/wall из `tiles.png`, юниты и подсветки поверх тайла, 0 ошибок в консоли.
  Не подключены (опц.): `spawn` и `hl_*`-тайлы — подсветки остались CSS-паттернами (дальтонизм, этап B).

### 🔧 Фиксы code-review (`review.md`, 2026-06-28)

Триаж 12 находок ревью → 10 живых исправлено, 2 (#5/#7) — частично подтверждены (см. ниже).
Гейт после фиксов: **80 тестов ✓** (75 + 5 новых регрессов `test/review-fixes.test.ts`), `tsc` чист,
`vite build` ок, живой Playwright-smoke (поражение → finalizeDefeat → retry, 0 ошибок в консоли).

- **#1 🔴 Поражение не теряет прогресс (§16.6).** Новый `finalizeDefeat` (`finalize.ts`): при `phase==='defeat'`
  применяет `worldPower += kills` и death-roll `unitLevel` павших, затем **запекает** их в `battleAttemptSnapshot`
  (worldPower + unitLevel), чтобы пережить откат retry/abandon. Флаг `BattleState.defeatFinalized` (защита от
  повтора/перезагрузки). Вызов — централизованно в `store.commit` (`maybeFinalizeDefeat`) → покрывает все боевые
  действия и авто-бой. Живой внутрибоевой L карт/предметов НЕ сохраняется (бой переигрывается с того же снимка, §6.8).
- **#2 🔴 proc_extra_hit ×100.** Данные `content/mods.ts`: `baseChance` 0.25/0.3/0.2 → 25/30/20 (проц.пункты,
  как все percent-ops); `rollProcExtraHits` делит /100 как и было. Тест на частоту (~25%, ловит регрессию в 100×).
- **#3 🔴 id-счётчик в персист.** `persistence.ts`: `idCounter` в envelope (`getIdCounter` при save, `resetIdCounter`
  при load ДО любого `nextId`); фолбэк для старых сейвов — `maxIdSuffix` (обход структуры, max base36-суффикса).
  Плюс минимальная валидация формы сейва (`isValidCampaign`) → битый сейв = новая игра.
- **#4 🟠 statMods в боевой математике.** `effectiveStat(unit, stat)` в `queue.ts` (база + statMods статусов);
  `unitInitiative` делегирует ему; `damage.ts` читает через него `statBonus`/critChance/defense. Бафы/дебафы карт
  теперь влияют не только на инициативу.
- **#5 🟠 базовая атака героя по классу.** `buildStrikeCard` (`spawn.ts`) резолвит `cls.baseAttack`
  (shot/magic_bolt/strike) и берёт `kind` из шаблона, а не хардкодит melee `strike`. (Триаж ошибочно счёл
  исправленным — поле `baseAttackId` ставилось, но карта строилась всё равно из strike.)
- **#6 🟠 павшие не получают victory-награды.** Guard `unit.hp<=0 → continue` в `applyVictoryRolls` (только death-roll).
- **#8 🟠 lucky в бою (§16.15).** Поля `BattleUnit.luckyCard/luckyItem` (из `luckyFlags` при спавне героя);
  `engine.useCard`/`basicAttack` прокидывают `{ lucky }` во внутрибоевые `rollLevelUpWithLuck`.
- **#10 🟡 уровень базовой атаки врага** = `unitLevel` (масштаб с worldPower), а не `unitId.length % 5`.
- **#11 🟡 pickWeighted** — throw на пустом пуле архетипов (вместо `undefined`→краш).
- **#12 🟡 item level-up** — `syncBattleProgress` использует `rollEquippedItemLevel` (guard «кулаки 0 не растут»);
  мёртвый `applyItemLevelUp` удалён (единственная реализация — `memento/victory.ts`).
- **cleanup:** `newGame`/`resetSave` сбрасывают ui-слайс (`freshUi`); баннер excluded в `App.tsx` закрываемый
  (`dismissExcluded`) и показывает имена вместо raw id.
- **НЕ менял #7** (prod-сборка стартует на dev-балансе) — осознанное решение (dev дефолт), задокументировано в
  `gen-project-decisions`; #9 закрыт частично (валидация формы добавлена, QuotaExceeded-флаг в UI — вне scope).

### ⚔️ Боссовые механики + UI модов (2026-06-29)

Гейт: **99 тестов ✓** (80 + 14 `test/boss-mechanics.test.ts` + 5 `test/campaign-mods.test.ts`), `tsc` чист,
`vite build` ок, живой Playwright-smoke: вкладка Memento → клик пустого слота → модал оффера → выбор мода
(`filled`, lm 0) → клик занятого слота → Popconfirm → снятие (`empty` + свежий оффер, откат L к полу вехи). 0 новых
ошибок консоли (есть лишь предсуществующее AntD `List`-deprecation).

**Боссовые механики (§13.4) + элементальные резисты рас (§13.3).** Данные уже были в контенте (8 боссов
`enemies.ts` с `bossMechanics[]`, расы `races.ts` с `affinities`) — реализован движок:
- `BattleUnit.bossMechanics?` + `summonedMinions?` (`types/battle.ts`); проброс `arch.bossMechanics` в `spawn.ts`.
- Новый модуль `battle/boss.ts`: константы баланса `BOSS`, чистые хелперы (`hasMechanic`, `dodgeChance`,
  `elementTag`, `isMagicTag`, `firstStrikeBonus`, `antiHealActiveAgainst`) — без зависимости от движка (только типы).
- `applyDamage` получил опц. `ctx`: уклонение (stealth/evasion), **резисты рас** (`ctx.resist`), spell_shield
  (магия ×0.5), damage_cap (потолок % maxHp/удар). Хук `ctx.resist` подключён в `store.battleContext` из `registry.races`.
  Важно: тег урона берётся через `elementTag(tpl.tags)` (стихия, а не `tags[0]`=вид).
- `resolveCardAmount` (`damage.ts`): enrage_below_half (×1.5 при HP<50% кастера).
- `useCard`: боссовый lifesteal (вампиризм на всех атаках поверх мод-lifesteal).
- `healUnit`: anti_heal (лечение противников живого босса ×0.3).
- `onTurnStart`: self_regen (% maxHp/ход) + summon_minions (одноразовый призыв миньонов рядом при HP<50%).
- `applyDefensiveProcs`: фиксированный боссовый reflect (% урона) поверх мод-reflect.
- `computeTurnOrder` (`queue.ts`): first_strike → бонус инициативы (ходит первым).

**UI модов (§16.8–16.9.1).** Ядро `memento/slots.ts` (`pickMod`/`removeMod`) было готово — добавлены оркестрация и UI:
- `campaign/mods.ts`: `pickCarrierMod`/`removeCarrierMod` — резолвят носителя (card/item/passive) персонажа,
  подбирают теги/пул/offerCount/soft-rollback, делегируют в ядро; возвращают `false` вместо исключений (стор безопасен).
- `store.ts`: экшены `pickMod`/`removeMod` (через `commit`, гард «нельзя в экспедиции»).
- `MementoTab.tsx`: слоты стали интерактивны — клик пустого слота открывает `Modal` с оффером (3–4 мода, описания,
  кнопка «Выбрать»); клик занятого — `Popconfirm` на снятие. Во время похода — `Alert` + слоты заблокированы.

### 🧩 Рефакторинг модульности (по `docs/modularity-review/2026-07-01`, 2026-07-09)

Закрыты все 3 находки review (оркестратор + субагенты, по задаче на агента). Гейт после каждой зелёный.

- **🔴 Critical — `resolveCardOutcome`.** Боевое правило исхода карты (сбор целей, дальность/LoS,
  величина, множитель центра AoE, крит, применение card-мод-эффектов) было триплицировано в
  `engine.ts`/`ui/battle-preview.ts`/`ai.ts`. Выделено в чистую `core/battle/outcome.ts::resolveCardOutcome`
  → `CardOutcome` (без мутаций). `engine.useCard` применяет план, превью рендерит тот же outcome, AI
  читает урон/дальность. `FixedRng`/`NO_CRIT`/`ALL_CRIT` перенесены в ядро. (+9 тестов → 108)
- **🟠 Significant — `resolveVictory`.** Последовательность исхода победы (finalizeBattle → inter-battle /
  finish-expedition + scenarioIndex+1 → shopOffers) вынесена из `store.finalizeVictory` в
  `core/campaign/finalize.ts::resolveVictory` → `VictoryResult`. Стор сведён к делегированию + rev/persist.
  Семантика (порядок, in-place мутации, дефолт золота) сохранена дословно. (+3 теста → 111)
- **🟡 Minor — селекторы UI→ядро.** Тонкие чистые селекторы `core/battle/selectors.ts`
  (`unitAt`/`unitHpPct`/`fieldSize`) и хелперы `core/campaign/selectors.ts` (`canAfford`/`participatingSquadIds`)
  + UI-утилита `ui/format.ts` (`pct`). Устранён дубль `canAfford` (Shop/Tavern), прямые чтения сырых
  боевых полей в `BattleScreen`, локальные `pct`/фильтр состава. Поведенчески нейтрально.

Итог: **111 тестов ✓**, `tsc` чист, `vite build` ок. Терпимые дисбалансы (raceAffinity-обёртка,
заглушка `migrate`) осознанно оставлены — низковолатильны.

## Открытые вопросы / допущения (решены дефолтами, отметить в docs)
- Тай-брейк initiative → по id юнита.
- LoS-алгоритм → супер-покрытие/Bresenham (определим в Этапе 2).
- statusEffects модель не задана спекой → ходовой счётчик + стак по правилам контента.
- Boss-механики реализованы как флаги `bossMechanics[]` + хелперы `battle/boss.ts` (не статусы). Числовые параметры —
  в `BOSS` (boss.ts), баланс черновой. summon_minions: миньон = уменьшенная копия босса (×0.4 статы, ×0.25 HP) с его
  базовой атакой, вступает в очередь со следующего раунда.
