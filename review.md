# Code Review — Gen (lyumih-gen-sp)

**Дата:** 2026-06-28
**Объём ревью:** весь `src/` (~8.6k строк) — репозиторий без коммитов, поэтому «диффом» считается вся первичная реализация.
**Методика:** high-effort recall — 8 независимых finder-углов (построчно, инварианты, межфайловые контракты, reuse/simplification/efficiency/altitude, соответствие спеке §16/§17, персистентность, конфигурация), затем верификация чтением исходников.
**Контекст:** известные заглушки из `implementation-report.md §5` (триггерные пассивы в бою, UI модов, боссовые механики, резисты рас, codex-события, replay) — НЕ репортятся как баги. Ниже — дефекты **сверх** задекларированных пробелов.

Сборка/типы предварительно прогонять не стал (репозиторий без CI); находки выведены из чтения кода и сверки со спецификацией. Все номера строк и цитаты ниже прошли **повторную сверку** с исходниками (вторым проходом), включая ранее не открытые лично места: `store.ts` (commit/autoStep/defeat-путь), `spawn.ts` (hero↔enemy strike), `cards.ts` (`statMods`), `engine.ts` (lucky-броски), `queue.ts`, `App.tsx`.

---

## Сводка

| # | Severity | Файл | Суть |
|---|----------|------|------|
| 1 | 🔴 High | store.ts / expedition.ts / finalize.ts | Поражение откатывает **весь** прогресс боя — нарушает ядро Memento Mori |
| 2 | 🔴 High | memento/mods.ts:173 | `proc_extra_hit`: шанс прока занижен ровно в 100× |
| 3 | 🔴 High | campaign/ids.ts | id-счётчик не персистится → коллизии id после перезагрузки |
| 4 | 🟠 Med | battle/damage.ts | `statMods` статус-эффектов игнорируются в боевой математике |
| 5 | 🟠 Med | campaign/spawn.ts:85 | Базовая атака героев всегда melee `strike`, класс `baseAttack` игнорируется |
| 6 | 🟠 Med | campaign/finalize.ts:144/179 | Павшему союзнику на победе достаётся двойной бросок `unitLevel` + награды |
| 7 | 🟠 Med | core/config.ts | Prod-сборка всегда стартует на `development`-балансе |
| 8 | 🟠 Med | battle/engine.ts:344/416 | `lucky_*` не прокидывается во внутрибоевые L-броски карт/оружия (§16.15) |
| 9 | 🟠 Med | campaign/persistence.ts | Слабая валидация сейва + молчаливое проглатывание `setItem`-ошибок |
| 10 | 🟡 Low | campaign/spawn.ts:257 | Уровень базовой атаки врага = `unitId.length % 5` |
| 11 | 🟡 Low | campaign/generators.ts:16 | `pickWeighted` на пустом пуле → `undefined` → краш |
| 12 | 🟡 Low | campaign/finalize.ts:128 | Inline-прокачка предмета без guard `itemLevel<=0` (+ дублирование) |

Плюс блок **efficiency** и **reuse/cleanup** в конце.

---

## Корректность

### 1. 🔴 Поражение откатывает весь прогресс боя — нарушение Memento Mori

**Где:** `src/state/store.ts:294,317,318` · `src/core/campaign/expedition.ts:132-160` · `src/core/campaign/finalize.ts:261-267`

`finalizeBattle` устроен правильно: death-roll'ы §16.6 и `worldPower += battle.enemyKills` он применяет **всегда**, а victory-броски — только при `battle.phase === 'victory'`:

```ts
campaign.worldPower += battle.enemyKills          // finalize.ts:255
const deaths = applyDeathRolls(campaign, battle, rng)  // всегда
if (battle.phase === 'victory') { applyVictoryRolls(...); applyRewards(...) }
```

Но **из стора `finalizeBattle` вызывается только через `finalizeVictory`**, а тот привязан исключительно к кнопке «Победа!» (`BattleScreen.tsx:220`). Ветка поражения (`BattleScreen.tsx:226`) предлагает только `retry()` / `abandon()`, и оба **откатывают** состояние к `battleAttemptSnapshot`:

```ts
// expedition.ts:148 abandonBattle
c.gold = snap.gold; c.worldPower = snap.worldPower
c.characters = deepClone(snap.characters); c.chest = deepClone(snap.chest)
```

**Итог:** при party-wipe игрок теряет всё, что заработал в бою — death-roll `unitLevel` павших (§16.6), `worldPower` за убитых врагов, живой прогресс L карт/оружия. Это прямо противоречит центральному принципу спеки (строка 32: *«прогресс не обнуляется с поражением»*) и §16.6 (*«конец боя victory/defeat»*). Защитная ветка в `finalizeBattle` существует, но **недостижима**.

**Тонкость:** снимок `battleAttemptSnapshot` берётся до боя (`expedition.ts:76`, `takeSnapshot`), и откат к нему на retry — корректное поведение (бой переигрывается). Конфликт именно в том, что §16.6 требует сохранить death-roll'ы и worldPower **даже на поражении**, а текущий откат их затирает вместе со всем остальным.

**Фикс:** при `phase==='defeat'` вызывать `finalizeBattle` (он сам пропустит victory-броски) и применять его результат (death-roll `unitLevel` павших + `worldPower`) **в сам снапшот** (или поверх восстановленного состояния), чтобы он пережил откат retry/abandon. Иначе — `finalizeDefeat`, фиксирующий только death-rolls/worldPower в персистентное состояние до выдачи retry/abandon.

---

### 2. 🔴 `proc_extra_hit`: шанс прока занижен в 100 раз

**Где:** `src/core/memento/mods.ts:173` + данные `src/core/content/mods.ts:77,85,228`

```ts
// rollProcExtraHits
if (rng.chance(proc.chance / 100)) extra += proc.hits
```

`proc.chance = scaleByLm(op.baseChance, lm)`, а в данных `baseChance` хранится **долей**: `0.25`, `0.3`, `0.2` (= 25/30/20%). При этом ВСЕ остальные percent-ops хранят **целые проц.пункты** и корректно делятся на 100: `damage_mult base:12`, `crit_chance_add base:8`, `lifesteal base:15`, `reflect base:20`. Только `proc_extra_hit` рассинхронизирован: `rng.chance(0.25/100) = rng.chance(0.0025)` → прок срабатывает с шансом **0.25% вместо 25%**.

**Фикс:** привести данные к единой конвенции — хранить `baseChance` в проц.пунктах (`25`, `30`, `20`), либо убрать `/100` именно для proc-ветки. Нормативный §16.12 — добавить unit-тест на ожидаемую частоту.

---

### 3. 🔴 id-счётчик не персистится → коллизии id после перезагрузки

**Где:** `src/core/campaign/ids.ts` (counter), `src/core/campaign/persistence.ts`

```ts
let counter = 0
export function nextId(prefix){ counter += 1; return `${prefix}_${counter.toString(36)}` }
export function getIdCounter(){ return counter }   // «для персиста» — но НИГДЕ не вызывается
```

`getIdCounter`/`resetIdCounter` не используются за пределами `ids.ts` (проверено grep'ом), и `saveCampaign`/`loadCampaign` счётчик не сохраняют. После перезагрузки `counter=0`, а в загруженной кампании уже есть инстансы `card_1`, `item_2`, `hero_1`. Первый же найм/покупка/дроп выдаёт `nextId('card') → card_1`, совпадающий с существующим инстансом.

**Сценарий поломки:** коллизия id → `find(x => x.id === ...)`, equip/bind, привязка карт к носителям начинают путать два разных объекта → исчезновение/дублирование предметов, возможный краш в бою.

**Фикс:** сериализовать `getIdCounter()` в envelope сейва и восстанавливать `resetIdCounter(saved)` при загрузке (до любого `nextId`). Запасной вариант — вычислять `max(existingIds)+1` при загрузке.

---

### 4. 🟠 `statMods` статус-эффектов игнорируются в боевой математике

**Где:** `src/core/battle/damage.ts` (читает `target.stats` / `caster.stats` напрямую) · единственный потребитель — `src/core/battle/queue.ts:20`

`statMods` активного статус-эффекта читается **только** для инициативы:

```ts
// queue.ts:20
init += st.statMods?.initiative ?? 0
```

`resolveCardAmount`/`statBonus` в `damage.ts` берут базовые `stats.*` и не учитывают `unit.statusEffects[].statMods` (статус хранит `statMods` через `engine.ts:371`, но потребляет его только `queue.ts:20`). В результате все бафы/дебафы на `attack/defense/critChance/magicPower/healPower/speed` из карт — **полный no-op**, кроме инициативной компоненты. Это не единичный случай: `cards.ts` содержит ≥10 таких карт (строки 169, 200, 216, 249, 265, 281, 423, 439, 521, 538), т.е. целый класс баф/дебаф-карт ничего не делает.

> Оговорка: боевые числа вынесены спекой из scope (§0), но механизм статус-`statMods` частично реализован (инициатива работает) — рассогласование «инициатива применяется, остальное нет» это дефект, а не отсутствие фичи. В §5 он не задекларирован.

**Фикс:** ввести `effectiveStat(unit, statId)`, суммирующий базу + `statusEffects[].statMods[statId]`, и читать его в `damage.ts` (и везде, где берётся боевой стат).

---

### 5. 🟠 Базовая атака героев всегда melee `strike`

**Где:** `src/core/campaign/spawn.ts:85` `buildStrikeCard`

```ts
const tpl = registry.cards.get(STRIKE_TEMPLATE_ID)   // всегда 'strike'
return { templateId: STRIKE_TEMPLATE_ID, kind: 'melee', ... }
```

Класс героя задаёт `baseAttack` (`classes.ts`: `shot` / `magic_bolt` для лучника/мага), а `ch.baseAttackId` даже проставляется на юните — но `buildStrikeCard` жёстко берёт `strike` (melee, range 1, `statSource: attack`). Маг/лучник получает **ближнюю атаку, скейлящуюся не от того стата**. При этом вражеский путь корректно резолвит шаблон: `spawn.ts:255` — `registry.cards.has(basicId) ? basicId : STRIKE_TEMPLATE_ID`. Налицо асимметрия hero↔enemy.

**Фикс:** выбирать шаблон базовой атаки по `cls.baseAttack` (тот же резолв, что у врагов), а `strike` оставить дефолтом для «кулаков».

---

### 6. 🟠 Павшему союзнику на победе — двойной бросок unitLevel + полные награды

**Где:** `src/core/campaign/finalize.ts:144` (death) и `:158-179` (victory)

`applyDeathRolls` катит `ch.unitLevel` для `hp<=0`, затем `applyVictoryRolls` итерирует **всех** player-юнитов с `characterId` **без проверки `hp>0`** и снова катит `ch.unitLevel = rollUnitLevel(...)` (`:179`) плюс L надетых предметов и Lm всех filled-слотов. Downed-герой на победе получает рост `unitLevel` дважды и полную экипировочную/мод-прогрессию, будто он сражался и победил.

> По букве §16.6/§16.7 обе секции применяются к «участникам отряда» без явного исключения downed, поэтому это **спорно**; но по смыслу Memento (павший получает консолационный death-roll, а не полный victory-payout) выглядит как непреднамеренный двойной начёт. Стоит сверить с эталонным намерением.

**Фикс:** если павшие не должны получать victory-награды — добавить `unit.hp > 0` guard в `applyVictoryRolls`; иначе явно задокументировать, что double-roll намеренный.

---

### 7. 🟠 Prod-сборка всегда стартует на `development`-балансе

**Где:** `src/core/config.ts:84-93` · `package.json` (`"build": "tsc -b && vite build"`)

```ts
function resolveDefaultProfile() {
  const fromEnv = ...import.meta.env?.VITE_GAME_PROFILE
  if (fromEnv === 'production' || fromEnv === 'development') return fromEnv
  return 'development'
}
```

Скрипт сборки не задаёт `VITE_GAME_PROFILE`, `.env`-файлов нет, `setProfile()` нигде не вызывается. Значит `dist/` всегда работает на `development` (вехи 5/5, дроп 10%, магазин 50%), а `production`-профиль (75/100, 1%, 3%) в отгружаемом артефакте **недостижим** — хотя именно его проверяют тесты §18.4. Рассинхрон между тем, что тестируется, и тем, что отгружается.

> Автор осознанно выбрал dev дефолтом (report §1.2), поэтому это скорее gap, чем баг — но «прод-баланс невозможно получить сборкой» стоит закрыть.

**Фикс:** дефолтить по `import.meta.env.PROD ? 'production' : 'development'`, либо передавать `VITE_GAME_PROFILE=production` в build-скрипте.

---

### 8. 🟠 `lucky_*` не прокидывается во внутрибоевые L-броски (нормативный §16.15)

**Где:** `src/core/battle/engine.ts:344` (`useCard`), `:416` (`basicAttack`)

```ts
if (rollLevelUpWithLuck(card.level, ctx.rng)) card.level += 1   // без { lucky }
...
if (rollLevelUpWithLuck(strike.level, ctx.rng)) strike.level += 1
```

`BattleContext` не несёт lucky-флагов, поэтому склонности `lucky_skill`/`lucky_item` дают 0 эффекта на внутрибоевом росте L карт и пер-атачном росте L оружия (а именно там карты растут — finalize только синкает `bc.level`). Победный бросок оружия в `finalize.applyVictoryRolls` lucky прокидывает корректно, но основной поудачный прогресс — нет. §16.15 требует один lucky-retry для этих бросков.

**Фикс:** прокинуть `luckyFlags(ch)` в `BattleContext`/в юнит и передавать `{ lucky: flags.card | flags.item }` во внутрибоевые `rollLevelUpWithLuck`.

---

### 9. 🟠 Персистентность: слабая валидация сейва + проглатывание ошибок записи

**Где:** `src/core/campaign/persistence.ts:20-25,31-34,42`

- **Валидация формы почти отсутствует:** проверяется только `typeof version === 'number'` и `campaign` truthy. Обязательные поля (`characters`, `squad`, `chest`, `phase`, `battle`) не проверяются. Повреждённый/обрезанный по квоте сейв, прошедший `JSON.parse`, считается валидным → `TypeError` на старте без fallback на `createNewCampaign`.
- **`setItem` в пустом `catch`:** `QuotaExceededError` / Safari Private Mode проглатываются — автосейв молча проваливается, игрок теряет час прогресса без предупреждения.
- **Ветка `env.version > SAVE_VERSION`** возвращает envelope как есть с расчётом «провалидируется загрузкой», но загрузка форму не валидирует; `migrate` мутирует входной `env.campaign` (побочный эффект).

**Фикс:** добавить минимальную проверку формы (наличие/тип ключевых полей) с откатом на новую кампанию; различать «нет окружения» и `QuotaExceededError` (хотя бы выставлять флаг «не сохранилось»).

---

### 10. 🟡 Уровень базовой атаки врага = `unitId.length % 5`

**Где:** `src/core/campaign/spawn.ts:257`

```ts
level: Math.max(1, unitId.length % 5)   // unitId = `enemy-${arch.id}-${index}`
```

Боевая величина (урон базовой атаки врага через `resolvePercentValue(level, token)`) детерминируется длиной строки id — то есть длиной имени архетипа и индексом. Переименование архетипа **молча** меняет силу врагов, и базовая атака не масштабируется с `worldPower`. Пластырь того же класса, что `ENEMY_POWER_SCALE`.

**Фикс:** брать уровень из `arch` (например `skillPresets[].level`) или из `unitLevel`/`worldPower`, а не из `unitId.length`.

---

### 11. 🟡 `pickWeighted` на пустом пуле → `undefined` → краш

**Где:** `src/core/campaign/generators.ts:9-17`

При `total===0` (пустой `arch`) цикл не выполняется и возвращается `arch[arch.length-1]! = arch[-1] = undefined`; вызывающие (`tunnel`/`small-skirmish`/`ambush`) сразу обращаются к `.id` → `TypeError`, обрыв построения сценария. Триггер: `normalEnemies(registry)` пуст (контент-сабсет только из боссов / всё отфильтровано).

**Фикс:** ранний guard `if (!arch.length) throw/возврат fallback` или валидация непустого пула на входе генератора.

---

### 12. 🟡 Inline-прокачка предмета без guard `itemLevel<=0` (и дублирование)

**Где:** `src/core/campaign/finalize.ts:128` (`syncBattleProgress`)

```ts
for (let h = 0; h < unit.hitsTaken; h++)
  if (rollLevelUpWithLuck(item.itemLevel, rng, { lucky })) item.itemLevel += 1
```

Этот цикл вручную повторяет хелпер `rollEquippedItemLevel` (`memento/victory.ts:26`), но **без** его guard'а `itemLevel <= 0` (фактически §16.5: «кулаки»/0-уровневые не растут). 0-уровневая броня/аксессуар здесь может вырасти вопреки правилу. Параллельно `applyItemLevelUp` (`levels.ts:86`) вообще без вызовов (мёртвый), что подтверждает тройную реализацию одного броска.

**Фикс:** вызывать `rollEquippedItemLevel` и здесь; удалить мёртвый `applyItemLevelUp` либо сделать `rollEquippedItemLevel` делегатом.

---

## Efficiency (горячие пути)

- **`store.ts:128-131` — синхронный автосейв на каждый `rev`.** `commit()` (стр. 128) зовёт `persist(c)` → `saveCampaign` → `JSON.stringify(всей кампании)` + `localStorage.setItem`. Подтверждено: `autoStep` (стр. 286-292) выполняется именно через `commit`, т.е. всё состояние (поле, юниты, очередь) сериализуется на **каждый** ход ИИ → фризы UI, деградация линейна по размеру сейва. → debounce/throttle, либо выносить запись из синхронного пути / сохранять не каждый шаг.
- **`BattleScreen.tsx:285` — грид O(W·H·U) на рендер.** На каждую клетку `battle.units.find(...)` + `turnOrder.indexOf(unit.id)`; грид перерисовывается на каждый commit. → один `Map<"x,y",unit>` и `Map<id,queueIdx>` перед циклом, рендер O(W·H+U).
- **`BattleScreen.tsx:79` — `computeHighlight` (BFS reachableCells / cardTargets+LoS) в теле компонента без `useMemo`** → pathfinding пересчитывается на каждом таймерном тике. → `useMemo` по `[rev, activeId, mode]`.
- **`CodexTab.tsx:21` — `buildCodex()` заново на каждом монтировании** вкладки, хотя готовая структура уже лежит в `registry.codex` (`content/index.ts:155`). → `[...registry.codex.values()]`.

## Reuse / cleanup

- **Тройная реализация item level-up:** `applyItemLevelUp` (`levels.ts:86`, мёртв) ↔ `rollEquippedItemLevel` (`victory.ts:26`) ↔ inline в `finalize.ts:128` (см. находку 12).
- **`finalize.ts:54/71` — `syncCardSlots` и `syncItemSlots` побайтово идентичны**, отличаются только полем уровня (`global_level` vs `itemLevel`). → один `syncSlots(slots, level, ...)`.
- **Дублирование cell-key и occupied-set:** `${x},${y}` / `key.split(',').map(Number)` копипастятся в `geometry.ts`, `ai.ts`, `engine.ts`; `ai.ts:75` пересобирает blocked-set, идентичный `occupiedCellKeys` в `engine.ts:50`. → экспортировать `occupiedCellKeys` + хелперы `cellKey`/`parseCellKey` в `geometry.ts`.
- **`collectModEffects(resolveCarrierMods(slots, mods))`** повторяется в `engine.ts:221,388` и `ai.ts:48,62`. → единый `resolveCarrierEffects(slots, registry)`.
- **Range+LoS проверка** копипастится трижды (`ai.ts:64`, `engine.ts:226,275`). → один `withinRangeAndLoS(field, from, to, range)`.

## UI-состояние (мелочи)

- **`store.ts:150` — `newGame()`/`resetSave()` не сбрасывают `ui`-slice:** `selectedCharacterId`, `squadSelection`, `autoBattle`, `excludedNotice` тянут устаревшие значения в новую кампанию.
- **`App.tsx:36-42` — баннер excluded показывает raw id** (`excluded.join('; ')` → `char_3; char_7`) вместо имён (успешный путь кладёт `built.excludedCharacterIds`, т.е. `ch.id`). В отличие от соседнего notice-Alert (`closable`/`onClose`, стр. 30-31) этот Alert **без** `onClose` — пользователь не может его закрыть.
- **`queue.ts:42` — `queueBadge` документирует ветку «R+позиция» для уже походивших, но реализован только `String(idx+1)`** — бейджи не отличают «походил» от «ждёт хода» (§6.3).

## Замечания по детерминизму (низкий приоритет)

- Стор использует один общий **неседированный** `MathRng` (`store.ts:46`), и его состояние не входит в сериализуемый `battle`. Сейв/перезагрузка посреди боя → расхождение потока случайностей (save-scum через reload). `retryCurrentBattle` тоже реролит расстановку героев (`battle-setup.ts:38` `rng.shuffle`) — повтор «той же попытки» по §6.8 даёт другую раскладку.
- `setupCurrentBattle` проверяет `squad.length===0`, но не гарантирует ≥1 **заспавнившегося** героя: при нехватке `heroSpawn.cells` все попадают в `excluded`, и бой стартует без союзников (мгновенное поражение).

---

## Что проверено и подтвердилось хорошим

- **Нормативное ядро §16** (`rollCardLevelUp`, `resolvePercentValue`, вехи слотов dev/prod, `generateOffer`, `scaleByLm`, броски победы/смерти) сверено со спекой один-в-один — расхождений, кроме `proc_extra_hit` (находка 2) и непрокинутого `lucky` (находка 8), не найдено.
- **Объёмы контента §17** точны: классы 8, расы 8, архетипы 31, пассивы 42, предметы 27, карты 41, моды 29 каталог / 23 active + 12 passive.
- **Слоистость** ядро↔UI чистая, RNG инжектируется.

Самокритика автора в `implementation-report.md §4-§5` честная и подтверждается кодом; настоящий отчёт добавляет к ней дефекты, которые саморефлексия не отметила, — прежде всего находки **1, 2, 3, 4, 7**.
