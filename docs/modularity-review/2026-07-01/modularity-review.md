# Modularity Review

**Scope**: весь код `src/` игры «Gen» — ядро (`core/battle`, `core/campaign`, `core/memento`, `core/content`, `core/types`), слой состояния (`state/store.ts`) и UI (`ui/*`).
**Date**: 2026-07-01

## Краткое резюме

«Gen» — браузерная пошаговая тактическая игра (React + Zustand + Vite, ~10k строк, единый деплой): бой на сетке, кампания-экспедиция, система прогрессии «Memento Mori» (уровни носителей и слоты модов) и статический контент. В целом ядро разбито разумно — чистые функции движка мутируют `BattleState`, случайность инжектируется через `Rng`, а UI диспатчит действия через один стор. Основная проблема [модульности](https://coupling.dev/posts/core-concepts/modularity/) не в структуре папок, а в **дублировании боевых бизнес-правил**: правила выбора целей и расчёта величины действия физически повторены в движке, в UI-превью и в ИИ. Это [функциональная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) в самом волатильном ([core](https://coupling.dev/posts/dimensions-of-coupling/volatility/)) поддомене — то есть [несбалансированная](https://coupling.dev/posts/core-concepts/balance/) связь, которую стоит чинить первой. Второстепенно: часть оркестрации игрового цикла «протекла» из ядра в стор, а `ModEffects` разделяется как сырая структура данных с повторной логикой применения.

## Обзор связности

| Интеграция | [Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | [Distance](https://coupling.dev/posts/dimensions-of-coupling/distance/) | [Volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) | [Balanced?](https://coupling.dev/posts/core-concepts/balance/) |
| ---------- | -------- | -------- | ---------- | --------- |
| `battle-preview.ts` (UI) → `battle/engine.ts` | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (дублированное правило, неявное) | Высокая (UI ↔ ядро) | Высокая (core-поддомен) | ❌ Нет — критично |
| `battle/ai.ts` → `battle/engine.ts`/`damage.ts` | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (пересчёт дальности/урона) | Низкая (тот же модуль) | Высокая | ⚠️ Частично (низкая дистанция сглаживает) |
| `state/store.ts` → `core/campaign` (поток игры) | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (последовательность цикла) | Высокая (UI-слой ↔ ядро) | Высокая | ❌ Нет — значимо |
| `ModEffects` → потребители (engine, damage, ai, spawn, preview) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) + применение полей | Средняя (ядро), высокая для preview | Высокая | ⚠️ Значимо |
| `BattleUnit`/`BattleCard` → spawn/engine/boss/ai/finalize/UI | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (широкая модель) | Средняя, высокая для UI | Высокая | ⚠️ Незначительно/структурно |
| UI-вкладки → доменные модели (`ch.items[]`, `battle.units[].x`, `o.instance…`) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) + мелкие формулы | Высокая (UI ↔ ядро) | Низкая (привязки отображения) | ✅ В основном терпимо |
| `state/store.ts` `battleContext` → `RaceDef.affinities` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (форма контента) | Высокая | Низкая | ✅ Терпимо |
| `persistence.ts` → всё дерево `CampaignState` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (структурная сериализация) | Высокая (граница сейва) | Низкая-средняя | ✅ Терпимо (тех. долг) |

> Замечание о [дистанции](https://coupling.dev/posts/dimensions-of-coupling/distance/): проект — единый деплой одного разработчика, поэтому социально-техническая дистанция минимальна. Но модель [фрактальна](https://coupling.dev/posts/core-concepts/balance/): на уровне абстракции «модуль» граница между `core` и `ui` — это максимальная доступная дистанция, и высокая [сила связи](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) через неё несбалансированна независимо от числа деплоев.

## Issue: Боевые правила разрешения действия триплицированы (движок / превью / ИИ)

**Integration**: `ui/battle-preview.ts` и `battle/ai.ts` → `battle/engine.ts` + `battle/damage.ts`
**Severity**: Critical

### Утечка знания

Правило «что делает карта» — какие цели она поражает, какова эффективная дальность, как считается величина, как применяется множитель центра AoE и крит — является бизнес-логикой [core-поддомена](https://coupling.dev/posts/dimensions-of-coupling/volatility/) и должно жить в одном месте. Вместо этого оно продублировано:

- **Выбор целей** в `engine.ts:399-411` (ветки `isAoe`/`isResurrect`/`isHealKind`/`buff`/иначе) буквально повторён в `battle-preview.ts:92-104`.
- **Расчёт дальности** `tpl.maxRange + effects.rangeAdd` независимо вычисляется в `engine.ts:375`, `ai.ts:63` и `battle-preview.ts:76`.
- **Множитель центра AoE** применён идентично в `engine.ts:435` и `battle-preview.ts:135-136`.
- **Оценка урона** для ИИ (`ai.ts:41-51 estimateCardDamage`) заново собирает `baseCardAmount` + `applyDamageMult`, зная порядок применения модов.

Комментарий в `battle-preview.ts` честно фиксирует намерение: «зеркалит сбор целей и расчёт величины из боевого движка». Это классическая [функциональная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) в её опасной, **неявной** форме — дублированное правило без явного контракта, связывающего копии.

### Влияние на сложность

Чтобы корректно изменить любое боевое правило, разработчик обязан удерживать в голове все 2–3 копии одновременно и синхронно их править. Это превышает предел рабочей памяти (4±1 единицы) и делает исход изменения [непредсказуемым](https://coupling.dev/posts/core-concepts/complexity/): если поправить только `engine.ts`, превью начнёт молча показывать неверные числа/зоны, а ИИ — принимать решения по устаревшей формуле. Расхождение не вызовет ошибку компиляции и всплывёт лишь как «странное поведение» в бою — то есть эффект изменения будет опознан только постфактум.

### Каскадные изменения

- Добавили новую механику дальности (например, мод «дальнобойность зависит от HP») → правки в `engine`, `ai` и `preview`.
- Изменили правило выбора целей resurrect/AoE → три синхронные правки, иначе превью и ИИ «врут».
- Ввели новый вид карты (`CardKind`) → ветки-`switch` по видам нужно обновить во всех трёх местах.

Дистанция `preview → engine` высокая (UI ↔ ядро, разные уровни абстракции), поэтому каждый такой каскад дорог и легко «забывается».

### Рекомендованное улучшение

Свести силу связи с функциональной к [контрактной](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/): выделить в `core/battle` **одну чистую функцию разрешения исхода**, например `resolveCardOutcome(state, caster, card, aim, ctx): CardOutcome`, которая возвращает описуемый результат (поражаемые клетки, цели, величины, крит-ветку, проки) **без мутаций**. Тогда:

- `engine.useCard` применяет `CardOutcome` к состоянию (мутирует по готовому плану);
- `battle-preview` рендерит тот же `CardOutcome` напрямую (превью исчезает как дубликат);
- `ai.estimateCardDamage`/`cardCanReach` читают дальность и величину из того же результата.

`CardOutcome` становится [интеграционным контрактом](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/), инкапсулирующим правило: знание живёт один раз, потребители зависят от стабильной формы результата, а не от повторённого алгоритма. Трейд-офф: одна дополнительная абстракция и небольшой рефакторинг движка; он оправдан тем, что правила боя — самая волатильная часть игры, и цена рассинхронизации здесь наивысшая.

## Issue: Оркестрация игрового цикла протекла из ядра в стор

**Integration**: `state/store.ts` → `core/campaign` (`finalize`, `expedition`)
**Severity**: Significant

### Утечка знания

Метод `finalizeVictory` (`store.ts:356-378`) держит **последовательность жизненного цикла** кампании: вызвать `finalizeBattle` → если победа, то `hasNextBattle` ? `toInterBattle` : `finishExpedition` + `scenarioIndex += 1` → при возврате в хаб перегенерировать `shopOffers`. `startExpedition` (`store.ts:284-309`) аналогично содержит логику выбора состава и ветвление `ok/excluded`. Это [функциональная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/): стор (UI-слой) знает бизнес-правила порядка и инварианты между функциями ядра. Контраст показателен — `retry`/`abandon`/`nextBattle` (`store.ts:379-382`) корректно делегированы в ядро одной строкой, а вот исход победы — нет.

### Влияние на сложность

Порядок шагов финализации критичен (например, магазин обновляется только после `finishExpedition`, а `scenarioIndex` инкрементится только на завершении цепочки). Держать этот инвариант в UI-слое значит, что любой, кто трогает поток игры, должен читать и ядро, и стор, чтобы понять полную картину — расщеплённое между слоями знание повышает когнитивную нагрузку и риск [непредсказуемого](https://coupling.dev/posts/core-concepts/complexity/) изменения.

### Каскадные изменения

- Изменили правила перехода между боями (например, «мини-босс каждый 3-й бой») → правка в сторе, а не в `core/campaign`, где живёт остальной поток.
- Добавили ещё одну точку, завершающую бой (не из UI, а из теста/скрипта) → последовательность придётся дублировать, потому что она не инкапсулирована в ядре.

### Рекомендованное улучшение

Перенести последовательность в ядро: `resolveVictory(campaign, registry, config, rng, gold): VictoryResult`, возвращающую следующий `phase`/`notice`. Стор лишь диспатчит вызов и обновляет `rev`/persist. Это опускает связь до [контрактной](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) (одна функция — один результат) и собирает весь поток экспедиции в `core/campaign`, где ему место. Трейд-офф: минимальный — по сути перенос ~20 строк из стора в ядро; выгода в том, что поток игры перестаёт быть «размазан» по слою представления.

## Issue: `ModEffects` разделяется как сырая структура данных с повторной логикой применения

**Integration**: `memento/mods.ts` (`ModEffects`) → `engine.ts`, `damage.ts`, `ai.ts`, `spawn.ts`, `battle-preview.ts`
**Severity**: Significant

### Утечка знания

`collectModEffects` возвращает плоскую структуру из ~16 полей, а каждый потребитель сам знает **как** применить конкретное поле: `effects.rangeAdd` складывается с дальностью, `aoeCenterDamageMult` умножается, `lifestealPct` делится на 100 и т. д. Это [модельная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/), которая на практике скатывается к функциональной: смысл и алгоритм применения поля продублированы в местах потребления (в частности, `aoeCenterDamageMult` — в `engine.ts:435` и `preview.ts:135`, что пересекается с критической находкой выше). Аггрегирующий шаг `collectModEffects` — хороший [контракт](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/), но он инкапсулирует только сбор, а не применение.

### Влияние на сложность

Добавление одного `ModOp` требует согласованных правок в пяти местах: юнион `ModOp` (`types/memento.ts`), `case` в `applyOp`, поле в `ModEffects`, его инициализация в `emptyModEffects`, и корректная точка применения в движке. Легко добавить эффект и забыть его где-то применить — [связность по смыслу](https://coupling.dev/posts/related-topics/connascence/) распределена и не проверяется типами в точке применения.

### Каскадные изменения

- Новый мод-эффект → 5 синхронных правок, часть из которых не ловится компилятором (пропущенное применение).
- Изменили семантику применения (например, `damageMult` стал мультипликативным, а не аддитивным) → правка в каждом потребителе.

### Рекомендованное улучшение

Инкапсулировать **применение**, а не только сбор: перенести логику «как эффект влияет на дальность/урон/лечение» в поведение рядом с `ModEffects` (функции `applyRange(base, eff)`, `applyDamage(base, eff)` и т. п.) либо, что лучше, — растворить эти точки применения в едином `resolveCardOutcome` из критической находки. Это укрепляет [контракт](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) до «эффекты знают, как себя применять», и убирает дублирование алгоритма у потребителей. Трейд-офф: чуть больше кода в `memento`, но добавление мода перестаёт быть «квестом по пяти файлам».

## Issue: `BattleUnit`/`BattleCard` — «магнит знаний», читаемый в том числе напрямую из UI

**Integration**: `types/battle.ts` → `spawn`, `engine`, `boss`, `ai`, `finalize` и напрямую `ui/BattleScreen.tsx`, `battle-preview.ts`
**Severity**: Minor

### Утечка знания

`BattleUnit` несёт поля сразу нескольких концернов: боя (`hp`, `stats`), боссов (`bossMechanics`, `summonedMinions`), склонностей (`luckyCard`, `luckyItem`), кампании (`characterId`), контента (`archetypeId`/`raceId`/`classId`), memento (`modSlots`, `defensiveMods`, `hitsTaken`) и ИИ (`skillPriorities`). Это широкая [модельная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/): каждый потребитель делит всю структуру. Дополнительно UI читает вложенные поля напрямую — `battle.units[].x/y` (`BattleScreen.tsx:96,392`), `active.stats.speed/critChance` (`BattleScreen.tsx:193-194`), `battle.field.width/height` (`423-424`), а `battle-preview.ts` — `card.modSlots`, `caster.stats.critChance`, `tgt.hp`.

### Влияние на сложность

Пока модель растёт аккрецией (каждая новая фича добавляет поле в общий `BattleUnit`), «радиус поражения» изменения структуры расширяется: правка формы юнита потенциально задевает spawn, движок, финализацию и несколько UI-компонентов. Внутри ядра дистанция средняя и это терпимо (высокая [сила при низкой дистанции = высокая связность/сплочённость](https://coupling.dev/posts/core-concepts/balance/)), но чтение сырых полей из UI поднимает дистанцию до максимальной.

### Каскадные изменения

- Переименование/реструктуризация поля юнита → правки в UI-компонентах, которые читают его напрямую.
- Новый под-концерн на юните (напр., статусные щиты) → рост общей модели, разделяемой всеми.

### Рекомендованное улучшение

Оставить единую модель внутри ядра (дробить её преждевременно вредно — это лишь увеличит дистанцию без снижения силы), но **закрыть прямой доступ UI** тонкими селекторами/хелперами (`unitAt(battle,x,y)`, `unitHpPct(unit)`, `fieldSize(battle)`), экспортируемыми из `core/battle`. UI начинает зависеть от небольшого [контракта](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) чтения, а не от полной формы боевых моделей. Трейд-офф: несколько хелперов; выгода — форму `BattleUnit` можно менять, не гоняясь за полями по компонентам.

## Issue: Прямой доступ UI к доменным моделям и мелкое дублирование формул

**Integration**: `ui/*` (вкладки) → `core` модели и формулы
**Severity**: Minor

### Утечка знания

UI-вкладки обходят внутренние структуры инстансов и повторяют тривиальные формулы: `canAfford` = `campaign.gold >= price` продублирован в `ShopTab.tsx:19` и `TavernTab.tsx:16`; `hpPct` = `Math.round(unit.hp/unit.maxHp*100)` (`BattleScreen.tsx:443`); `pct` (`MementoTab.tsx:461-464`); фильтрация участников отряда (`ExpeditionTab.tsx:20-21`). Вкладки также читают вложенные поля memento напрямую (`c.modSlots`, `c.global_level`, `c.uses_count` — `MementoTab.tsx:258-263`). Это [модельная связность](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) с мелкими вкраплениями функциональной через высокую дистанцию UI ↔ ядро.

### Влияние на сложность

Само по себе невелико: формулы тривиальны, а форма отображаемых моделей меняется редко ([низкая волатильность](https://coupling.dev/posts/dimensions-of-coupling/volatility/) этих связей нейтрализует дисбаланс — правило баланса допускает такой прагматизм). Риск скорее в дрейфе: `canAfford`, размноженный по вкладкам, однажды разойдётся (например, при появлении скидок).

### Каскадные изменения

- Ввели правило скидок/налога на покупку → надо найти все копии `canAfford`.
- Изменили расчёт «занятости» отряда → правка в UI, а не в одном хелпере.

### Рекомендованное улучшение

Опустить туда, где дёшево: вынести `canAfford(campaign, price)` и подсчёт состава в хелперы `core/campaign`, а `hpPct`/`pct` — в UI-утилиту. Это низкоприоритетно — заниматься оппортунистически при следующем касании этих экранов. Учитывая, что связи низковолатильны, полноценный [ACL](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) между UI и моделями здесь избыточен.

## Терпимые дисбалансы (не требуют действий сейчас)

Отмечаю для полноты — это несбалансированные, но **низковолатильные** связи, где [правило баланса](https://coupling.dev/posts/core-concepts/balance/) прощает дисбаланс:

- **`store.battleContext` знает форму `RaceDef.affinities`** (`store.ts:60-63`): стор лезет в `registry.races.get(raceId)?.affinities[damageTag]`. Мелкая утечка формы контента в UI-слой; форма стабильна. При желании — обернуть в `raceAffinity(registry, raceId, tag)` в `core/content`.
- **`persistence.ts` структурно сериализует всё дерево `CampaignState`** (включая `BattleState`): любое изменение доменной модели становится вопросом миграции сейва, а `migrate` пока заглушка. Для одиночного localStorage-приложения это приемлемый технический долг; каркас миграций уже заложен.

---

_This analysis was performed using the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com)._
