# Архитектура

Строгое разделение слоёв (инвариант §2 спеки): **вся игровая логика — в чистом ядре без
UI-зависимостей**. UI — тонкий презентационный слой поверх ядра и стора.

```
src/core/
  config.ts            профили dev/prod, лимиты §4.3, константы
  rng.ts               инжекция RNG: SeededRng (mulberry32, детерминизм) / MathRng (рантайм)
  types/               доменные типы (stats, cards, battle, memento, character, content, campaign)
  memento/             НОРМАТИВНОЕ ядро §16: levels, percent, slots, mods, victory
  battle/              бой §6: geometry (манхэттен/LoS/BFS), queue, damage, outcome, engine, ai, boss, selectors
  content/             контент §17 (8 классов, 41 карта, 31 враг, …) → buildContentRegistry()
  campaign/            мета §4/§8–§12: factory, spawn, shop, tavern, chest, expedition, finalize, mods, selectors, persistence
src/state/store.ts     Zustand: единый стейт кампании + UI-флаги сессии, все экшены
src/ui/                React 19 + AntD 6: App-роутер по фазе, HubScreen (6 вкладок), BattleScreen, InterBattleScreen
```

Алиасы путей: `@core/*`, `@state/*`, `@ui/*`.

## Поток данных

- **Ядро** — чистые функции, принимают состояние + RNG, возвращают новое состояние/план.
  Мутации in-place допускаются внутри стора, но боевые «правила» (исход карты, исход победы)
  вынесены в чистые функции ядра.
- **Стор** (`store.ts`) — держит `campaign` (персистентный) + ui-слайс сессии; экшены идут
  через `commit`, который бампает `rev` и пишет автосейв. UI подписан на `rev` (стор мутирует
  на месте — стабильная ссылка не меняется, поэтому эффекты завязаны на `rev`, не на объект).
- **UI** — читает через селекторы ядра, не лезет в сырые модели напрямую.

## Ключевые чистые правила (вынесены из стора/движка)

- `core/battle/outcome.ts::resolveCardOutcome` — **единственный** источник правила исхода
  карты (цели, дальность/LoS, величина, множитель центра AoE, крит, card-мод-эффекты).
  `engine.useCard` применяет план, `ui/battle-preview.ts` рендерит тот же outcome, `ai.ts`
  читает. Раньше правило было триплицировано — не дублировать снова.
- `core/campaign/finalize.ts::resolveVictory` — последовательность исхода победы
  (finalizeBattle → inter-battle / finish-expedition + scenarioIndex+1 → shopOffers).
  Стор делегирует сюда + rev/persist.
- Селекторы: `core/battle/selectors.ts` (`unitAt`/`unitHpPct`/`fieldSize`),
  `core/campaign/selectors.ts` (`canAfford`/`participatingSquadIds`), `ui/format.ts` (`pct`).

## Неочевидные инварианты (легко сломать при правках)

- **Boss-механики = флаги `BattleUnit.bossMechanics[]` + чистые хелперы `core/battle/boss.ts`**,
  НЕ статус-эффекты. Числовые параметры баланса — в объекте `BOSS` (boss.ts), баланс черновой.
  summon_minions: миньон = уменьшенная копия босса (×0.4 статы, ×0.25 HP) с его базовой атакой,
  вступает в очередь со следующего раунда.
- **Стихия урона ≠ `tpl.tags[0]`.** `tags[0]` — это вид (`melee`/`aoe`/`skill`), стихия лежит
  отдельным тегом. Брать через `elementTag(tpl.tags)`, иначе резисты рас (§13.3) и spell_shield
  молча не работают.
- **`ctx.resist`** (хук резистов рас) подключается в `store.battleContext` из `registry.races`;
  `applyDamage` применяет его только при переданном `ctx`. DoT-тики (`onTurnStart`) идут без
  ctx — резист к ним не применяется осознанно.
- **Действия над модами** идут через `campaign/mods.ts` (`pickCarrierMod`/`removeCarrierMod`)
  → стор-экшены `pickMod`/`removeMod`. Ядро `memento/slots.ts` бросает исключения на невалидном
  слоте, поэтому обёртки в `campaign/mods.ts` валидируют и возвращают `false` (стор безопасен).
- Изменение модов **запрещено во время похода** (гард `campaign.expedition` в сторе +
  блокировка в `MementoTab`).
- **Поражение не теряет прогресс** (§16.6): `finalizeDefeat` применяет `worldPower += kills` и
  death-roll павших, запекает в `battleAttemptSnapshot` (переживает откат retry/abandon). Флаг
  `BattleState.defeatFinalized` защищает от повтора. Вызов централизован в `store.commit`.
- **`statMods` статусов** учитываются в боевой математике через `effectiveStat(unit, stat)`
  (`queue.ts`) — не только в инициативе, но и в уроне/крите/защите.

## Допущения (спека не задаёт — приняты дефолты)

- Тай-брейк initiative → по `unitId`.
- LoS → Bresenham (супер-покрытие).
- Модель statusEffects → ходовой счётчик + стак по правилам контента.
- Балансовые формулы боя (урон/защита/крит) — вне нормативного scope §0, наша линейная
  модель, см. [balance.md](balance.md).
