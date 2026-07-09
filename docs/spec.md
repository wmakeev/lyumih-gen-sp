# Gen — спецификация для реализации (AI clone spec)

**Версия:** 2026-06-24  
**Назначение:** единый документ для реализации клона игры **Gen** с нуля (например, на Claude) и сравнения с эталонной реализацией в репозитории `gen-sp`.  
**Язык UI:** русский.  
**Платформа:** браузер, 2D, single-player, автосохранение в `localStorage`.

---

## 0. Как читать этот документ

| Раздел | Уровень детализации |
|--------|---------------------|
| §1–§15 | **Поведенческая спека** — что должно работать; без привязки к стеку, файлам и конкретному контенту |
| §16 | **Memento Mori** — полная нормативная реализация (формулы, алгоритмы, типы) |
| §17 | **Объёмы контента** — сколько сущностей каждого типа |
| §18 | **Критерии приёмки** — чеклист для верификации клона |

**Не входит в спеку:** конкретные названия умений, предметов, врагов, тексты модов, балансные числа урона (кроме формул Memento). ИИ должен создать **заглушки контента** в указанных количествах с правильной структурой данных.

---

## 1. Концепция игры

**Gen** — тактическая RPG с пошаговыми боями на квадратной сетке (4 ортогональных направления). Игрок:

1. Собирает **отряд** из roster персонажей.
2. Ведёт **экспедиции** — цепочки боёв без возврата в хаб.
3. Качает **умения**, **пассивные навыки**, **экипировку** и **персонажей** через систему **Memento Mori**.
4. Торгует в **магазине**, нанимает в **таверне**, изучает **кодекс**.

**Ключевая идея Memento Mori:** прогресс **не обнуляется** с поражением. Сила накапливается по трём осям:

- **Смерть** → рост уровней сущностей и силы мира (`worldPower`).
- **Использование** → рост уровня носителей (`L`: умения, оружие, броня, пассивы).
- **Победа** → рост модификаторов (`Lm`) в слотах носителей.

**MVP-ограничения:** нет мультиплеера, серверной валидации, карты мира, гексагональной сетки, гачи.

---

## 2. Архитектурные требования (минимум)

Реализация должна разделять:

| Слой | Требование |
|------|------------|
| **Игровое ядро** | Чистые функции + типы; без UI-фреймворка; детерминированные тесты с инжекцией RNG |
| **UI** | Отдельный слой; отображает состояние и диспатчит действия |
| **Глобальное состояние** | Один store кампании + UI-флаги сессии |
| **Персистентность** | Сериализуемый snapshot кампании; версия схемы + миграции при изменении структуры |

**Инвариант:** вся игровая логика (валидация ходов, награды, прокачка) живёт в ядре; UI не принимает решений.

---

## 3. Фазы и навигация приложения

### 3.1. Фазы кампании (`RunPhase`)

| Фаза | Экран | Описание |
|------|-------|----------|
| `hub` | Campaign Hub | Магазин, персонажи, таверна, кодекс, справка |
| `battle` | Battle Screen | Активный бой |
| `victory` | (внутри battle flow) | Победа; финализация наград |
| `defeat` | (внутри battle flow) | Поражение; retry / abandon |
| `inter_battle` | Inter-Battle Screen | Между боями expedition |

**Маршрутизация:**

- `inter_battle` → Inter-Battle Screen
- `battle !== null` → Battle Screen
- иначе → Campaign Hub

### 3.2. Фазы боя (`BattlePhase`)

`ongoing` | `victory` | `defeat`

### 3.3. Вкладки хаба (порядок навигации)

1. **Персонаж** — roster, отряд, экипировка, умения, пассивы, сундук
2. **Магазин** — покупка, продажа, сундук
3. **Таверна** — найм кандидатов
4. **Кодекс** — энциклопедия открытого контента
5. **Справка** — правила игры (доступна всегда, включая бой)

Дополнительно: вкладка **Бой / Экспедиция** (старт expedition, выбор режима).

---

## 4. Модель кампании

### 4.1. `CampaignState` (ключевые поля)

| Поле | Смысл |
|------|-------|
| `scenarioIndex` | Прогресс линейной кампании (индекс в статических сценариях) |
| `worldPower` | Глобальная сила мира; растёт при убийстве врагов |
| `gold` | Валюта |
| `phase` | Текущая фаза рана |
| `characters` | Roster персонажей (до 100) |
| `squad` | 4 слота отряда в хабе (`characterId \| null`) |
| `expedition` | Активная экспедиция или `null` |
| `chest` | Общий сундук (предметы, непривязанные умения и пассивы) |
| `shopOffers` | Текущие офферы магазина |
| `tavernCandidates` | Кандидаты таверны |
| `codexDiscovered` | Set открытых записей кодекса |
| `battle` | Снимок активного боя |
| `battleAttemptSnapshot` | Снимок попытки для retry |
| `battleAttemptId` | Счётчик попыток (для RNG дропа) |
| `pendingHubNotice` | Уведомление при возврате в хаб (дроп, раскрытие склонности) |

### 4.2. `Character`

| Поле | Смысл |
|------|-------|
| `id`, `name`, `classId` | Идентичность |
| `unitLevel` | Уровень персонажа (Memento за победу / смерть) |
| `baseStats` | 9 базовых статов (фиксируются при найме) |
| `baseStatRating` | Среднее качество roll (0–1+) |
| `specializationId` | Склонность (выдаётся при найме, неизменна) |
| `equipment` | 3 слота: weapon, armor, accessory |
| `items`, `cards`, `passives` | Инвентарь персонажа |
| `battleLoadout` | До 3 активных умений в бою (+ бонус от склонности) |
| `passiveEquip` | До 4 надетых пассивов |
| `iconEmoji`, `iconAccent`, `iconSkinTone` | Облик |

### 4.3. Лимиты

| Параметр | Значение |
|----------|----------|
| Слотов отряда в хабе | 4 |
| Макс. roster | 100 |
| Мин. roster (для отпуска) | 1 |
| Слотов экипировки | 3 (weapon, armor, accessory) |
| Активных умений в бою | 3 (база) |
| Пассивов во владении | 4 (база) |
| Надетых пассивов | 4 (база) |

---

## 5. Базовые характеристики

### 5.1. Девять статов

| id | RU | Влияние |
|----|-----|---------|
| `health` | Здоровье | max HP |
| `defense` | Защита | снижение входящего урона |
| `attack` | Атака | бонус физического урона |
| `magicPower` | Сила магии | бонус магического урона |
| `mana` | Мана | ресурс (зарезервировано) |
| `healPower` | Сила исцеления | бонус лечения |
| `speed` | Скорость | дальность перемещения за ход |
| `initiative` | Инициатива | порядок хода каждый раунд |
| `critChance` | Шанс крита | % крита |

### 5.2. Effective stats

Для юнита на поле:

```
effectiveStat = round(baseStat × (1 + 0.01 × unitLevel + 0.01 × worldPower))
```

+ бонусы экипировки, пассивов, модов (пассивные `carrier_hp_add`, `defense_add`, `initiative_add`).

### 5.3. Roll кандидата таверны

- 8 классов с primary (+50% верхней границы roll) и secondary (+25%) статами.
- Значение может **превышать config max** (jackpot roll).
- После найма статы **фиксируются**.

### 5.4. UI статов

Компактная строка: emoji + число для каждого стата; rating `★{percent}%` в конце. Tooltip: база → экипировка → итог.

---

## 6. Боевая система

### 6.1. Поле

- Квадратная сетка произвольного размера (задаётся сценарием / генератором).
- **4 ортогональных направления** (без диагоналей).
- Клетки: проходимые, стены (непроходимые), юниты.
- Дистанция: **манхэттен**.
- Дальние атаки: проверка **line of sight** (без стен на линии).

### 6.2. Юнит

| Поле | Смысл |
|------|-------|
| `side` | `player` \| `enemy` |
| `x`, `y` | Позиция |
| `hp`, `maxHp` | Здоровье |
| `unitLevel` | Уровень (для scaling) |
| `initiativeBase` | Инициатива при спавне |
| `baseStats` | Снимок для tooltip |
| `archetypeId`, `raceId` | Для врагов |
| `displayName`, `iconEmoji`, … | Отображение |
| `statusEffects` | Баффы/дебаффы |

### 6.3. Очередь хода

- Каждый **раунд** пересчитывается порядок по **initiative** (убывание).
- Юниты с `hp = 0` (**downed**) **исключаются** из очереди.
- Бейдж на клетке: позиция в очереди (`1`, `2`, …, `R+N` для следующего раунда).

### 6.4. Действия за ход (одно основное)

| Действие | Описание |
|----------|----------|
| `move` | Перемещение на доступные клетки (BFS, `speed` клеток) |
| `attack` / `strike` | Базовая атака (ближняя или дальняя) |
| `use_card` | Применение умения из loadout |
| `end_turn` | Пропуск |

**Карта `strike`:** канал базовой атаки; **без** собственного `L` и модов. Прогресс идёт на **оружие** в слоте weapon.

### 6.5. Типы умений (`CardKind`)

`melee`, `ranged`, `aoe`, `heal`, `regen`, `resurrect`, `buff`, `debuff`, `dot`, `lifesteal_spell`, `utility`

Каждое умение: `maxRange`, `statSource`, `skillFlat`, `scaleToken` (токен `%%`), `cooldownTurns`, `tags`.

**Cooldown:** умения имеют перезарядку в ходах; `strike` без CD.

### 6.6. Урон и лечение карт

```
amount = skillFlat + resolvePercentValue(global_level, scaleToken) + statBonus
```

Уровень для `%%` — **`global_level` до применения** (момент замаха).

Экипировка может давать `cardLevelBonusPerItemLevel` — добавляется к уровню для расчёта урона.

### 6.7. Смерть и downed

- `hp = 0` → юнит **downed**, не удаляется с поля.
- Downed не ходит, не атакуется как живая цель (по правилам контента).
- **Воскрешение:** умения `resurrect`, лечение выше 0 HP, inter-battle revive.
- При окончании боя: Memento death roll для downed союзников (§16.6).

### 6.8. Победа / поражение

| Исход | Условие |
|-------|---------|
| Победа | Все враги downed/мёртвы |
| Поражение | Все союзники downed (party wipe) |

**Поражение в кампании:** сейв **не стирается**; игрок **повторяет текущий бой** (`RETRY_CURRENT_BATTLE`) или **сбрасывает попытку** (`ABANDON_BATTLE`) к снимку `battleAttemptSnapshot`.

### 6.9. `worldPower`

- При **смерти врага** (hp → 0): `worldPower += 1` (константа MVP).
- Влияет на effective stats всех юнитов в последующих боях.

### 6.10. Спавн

- Герои: зона спавна сценария; детерминированный shuffle; при нехватке клеток — часть героев **excluded** (Alert в UI).
- Downed члены expedition **не спавнятся**.
- Враги: фиксированные или процедурные позиции.

### 6.11. AI

**Враги:** выбор умения по приоритетам (`skillPriorities`); фолбэк на `strike`/`shot`/`magic_bolt`.

**Автобой героя (опционально UI):**

- Toggle в бою; флаг **только сессии** (не в save).
- Задержка 2000 ms перед ходом.
- Цель: ближайший враг; приоритет добивания.
- Карта: максимальный урон; greedy move (без A*).
- v1: только атакующие карты (без heal/AoE/utility).

### 6.12. Battle log

Текстовый лог событий: удары, лечение, procs модов, криты.

---

## 7. Пассивные навыки

### 7.1. Модель

Зеркало `CardInstance`: `global_level`, `uses_count`, `modSlots`.

### 7.2. Правила

| Правило | Значение |
|---------|----------|
| Владение | ≤ 4 пассива на героя |
| Экипировка | ≤ 4 надетых; только надетые активны в бою |
| Привязка | После `BIND` — навсегда к герою |
| Прокачка L | При **успешном срабатывании** эффекта (proc — только при успехе) |
| Моды | Общий движок Memento; **отдельный пул** из 12 модов |
| Стакинг статов | Не более одного flat и одного % бонуса на `statId` среди надетых |

### 7.3. Триггеры (примеры)

`on_strike`, `on_card_use`, `on_heal`, `on_damaged`, `on_turn_start`, `on_kill`, `on_battle_start`, …

Движок: `firePassives(trigger, context)` в точках боя.

### 7.4. Cooldown умения

Базовые `cooldownTurns` в шаблонах **×2** (кроме `strike`).

---

## 8. Экипировка и инвентарь

### 8.1. Предмет

```
ItemInstance { id, templateId, itemLevel, modSlots }
```

### 8.2. Шаблон предмета

- `slot`: weapon | armor | accessory
- `shopPrice`
- `hpBonusPerItemLevel` — бонус maxHp
- `cardLevelBonusPerItemLevel` — бонус к уровню для урона карт
- `tags` — для фильтра модов

### 8.3. Экипировка

- Только совместимый `slot`.
- Один предмет — один слот; замена атомарна.
- Снятие → предмет остаётся в `items`.

### 8.4. Прогресс L предметов

| Слот | Триггер роста L |
|------|-----------------|
| weapon | Базовая атака (`strike`/выстрел) |
| armor, accessory | Получение удара от врага |
| Пустой weapon | «Кулаки»: `itemLevel = 0`, модов нет, прогресса нет |

### 8.5. Сундук кампании

```
CampaignChest {
  items: ItemInstance[]
  unboundCards: CardInstance[]
  unboundPassives: PassiveInstance[]
}
```

- Покупки умений/пассивов → сундук.
- `BIND_CHEST_CARD` / `BIND_CHEST_PASSIVE` → персонаж (необратимо).
- Предметы: сундук ↔ персонаж в обе стороны (если не надеты).

### 8.6. UI инвентаря

Сетка ячеек; DnD reorder; preview delta stats при смене экипировки; бейдж **M+** на носителях с pending mod offer.

---

## 9. Экономика и магазин

### 9.1. Золото

- Начисление за победу (формула от сценария).
- Трата: покупки, обновление магазина, таверна.

### 9.2. Магазин

| Параметр | Production | Development |
|----------|------------|-------------|
| Слотов предметов | 5 | 5 |
| Шанс умения/пассива в оффере | 3% каждый (независимые roll) | 50% |
| Цена умения/пассива | 1000 | 100 |
| Стоимость обновления | 100 | 10 |

- Покупка предмета: в сундук или напрямую персонажу.
- Покупка умения/пассива: всегда в сундук.
- **Продажа** предметов из инвентаря (popover с ценой).

### 9.3. Дроп после боя

| Параметр | Production | Development |
|----------|------------|-------------|
| Шанс умения | 1% | 10% |
| Шанс пассива | 1% (независимый roll) | 10% |

Оба могут выпасть → dual drop notice.

---

## 10. Таверна

- Генерация **N кандидатов** (конфиг) с roll статов по классу.
- Карточка: класс, цена, StatStrip + rating, стартовая экипировка (3 предмета класса).
- **Склонность скрыта** до найма.
- При найме: 1 случайное умение (кроме `strike`) + 1 склонность + фиксация статов.
- Обновление кандидатов за золото.
- Стартовый герой кампании: фиксированный warrior с предустановленными статами (не roll).

---

## 11. Склонности (character specialization)

**15 склонностей**; равный шанс при найме; **неизменны**.

### 11.1. Область действия

| Тип | Область |
|-----|---------|
| Удача (`lucky_*`) | Носители **владельца** (карты, предметы, пассивы, unitLevel) |
| Мета (`meta_*`) | **Вся команда**, если владелец в отряде |
| Слоты (`slot_*`, `mod_*`) | Носители и лоадаут владельца |

- Активна, если персонаж в `squad` или `expedition.squadSnapshot`.
- `metaStatus === 'downed'` **не отключает** мета-эффекты.
- Дубликаты мета в отряде: **лучший** бонус, не суммируются.

### 11.2. Примеры эффектов

- `lucky_card`, `lucky_item`, `lucky_passive`, `lucky_unit` — retry при провале Memento roll
- `meta_drop_skill` — бонус к шансу дропа
- `slot_skill_plus` — +1 слот умений
- `mod_offer_plus` — оффер из **4** модов вместо 3
- `mod_soft_rollback` — при удалении мода потеря 20% прогресса внутри вехи (не полный откат)

**Не путать** со «специализацией Memento» (carrier preset) — отдельная система, вне scope v1.

---

## 12. Экспедиции

### 12.1. Expedition state

```
Expedition {
  scenarioChainId
  generationSeed      // детерминизм процедурной генерации
  partySize
  squadSnapshot       // freeze состава + metaStatus
  battleIndex
  battleCount
  shopLocked: true
  interBattleReviveAllDowned?: boolean  // camp rule
}
```

### 12.2. Freeze хаба

Во время expedition **заблокированы:** магазин, таверна, смена экипировки, DnD отряда.

### 12.3. Между боями

- Downed персонажи **не участвуют** в следующем бою без revive.
- **Без замены** из резерва.
- `INTER_BATTLE_REVIVE_ALL` — если сценарий разрешает (`interBattleReviveAllDowned`).
- После последнего боя → `FINISH_EXPEDITION` → хаб; downed → available.

### 12.4. Каталог режимов (7 цепочек)

| ID | Тип | Боёв | Особенности |
|----|-----|------|-------------|
| `campaign-main` | static | 3 | Линейная кампания; revive между боями |
| `test-single-battle` | static | 1 | Dev-тест |
| `chaotic-map` | procedural | 1–3 | Случайное поле 1×2…20×20, 1–20 врагов |
| `tunnel` | procedural | 2 | Коридор 1×10; бой 2: hero NPC или босс |
| `big-arena` | procedural | 1 | 10×20; 8–12 врагов + 1–3 босса |
| `small-skirmish` | procedural | 1 | 1×2; дуэль |
| `ambush` | procedural | 1 | 10×10; центр vs периметр |

### 12.5. UI подбора

- 4 ячейки отряда; чекбоксы участия (радио-поведение для expedition).
- Не отмечено → идут все занятые слоты.
- Отмечено больше лимита → первые N по порядку слотов.
- Старт blocked, если бойцов < `partyMin`.

### 12.6. Статические сценарии (3)

`tutorial`, `two-front`, `boss-lite` — фиксированные поля, враги, спавны.

Босс-кампания: каждый **4-й** слот сценария — босс.

---

## 13. Враги и боссы

### 13.1. Архетип врага

- `baseStats`, `raceId`, опционально `classId`
- `counterClass` — контрит стиль класса в смешанном отряде
- `baseAttack`: strike | shot | magic_bolt
- 0–4 умения, 0–4 пассива (фиксированные L и пресет модов)
- `skillPriorities` для AI
- `threatTags`, `spawnWeight`
- Флаги: `isBoss`, `isChaotic`

### 13.2. Scaling

```
effectiveStat = round(baseStat × powerMult × varianceMult)
powerMult = f(unitLevel, worldPower)  // та же формула §5.2
```

- Обычный: один `varianceMult ~ U(0.5, 1.5)` на все статы.
- Хаотичный (`isChaotic`): per-stat variance.

### 13.3. Расы (8)

beast, undead, human, orc, elf, specter, construct, demon

Элементальные резисты/уязвимости к тегам урона.

### 13.4. Боссы

- 8 боссов (по 1 на класс героя).
- Эксклюзивные умения и пассивы.
- Специальные механики (`bossMechanics`: отражение, stealth, anti-heal, …).

---

## 14. Кодекс и справка

### 14.1. Кодекс

7 категорий: class, affinity, item, card, passive, enemy, mod.

Запись открывается при: найме, покупке, дропе, первом применении, встрече врага, выборе мода.

Unread badge на вкладке.

### 14.2. Справка

8 секций в Collapse; **Memento Mori** раскрыта по умолчанию.

Тексты — игровой язык, без формул (формулы — в §16 для реализации).

---

## 15. Персистентность

- `localStorage` с envelope `{ version, campaign }`.
- При изменении структуры: `SAVE_VERSION++`, миграции в `migrate.ts`.
- `battleAttemptSnapshot` включает: gold, items, equipment, cards, party, `scenarioSlotIndex`, `worldPower`.
- Retry восстанавливает snapshot **полностью** (анти-дюп наград).

### 15.1. Replay кампании

После прохождения всех статических сценариев (`scenarioIndex >= count`):

- Игрок может запускать **любой** сценарий повторно.
- `scenarioIndex` **не растёт** при победе в replay.
- `scenarioSlotIndex` в snapshot обязателен для корректного retry.

---

## 16. Memento Mori — нормативная реализация

> **Это единственный раздел с полными деталями реализации.** Всё ниже — обязательно к точному воспроизведению.

### 16.1. Три оси прогресса

| Событие | Что растёт | Поле |
|---------|------------|------|
| Использование умения в бою | L умения | `CardInstance.global_level` |
| Базовая атака с оружием | L оружия | `ItemInstance.itemLevel` (weapon) |
| Получение удара (броня/акс.) | L предмета | `ItemInstance.itemLevel` |
| Срабатывание пассива | L пассива | `PassiveInstance.global_level` |
| Победа в бою | Lm каждого filled mod slot | `modSlots[i].lm` |
| Победа в бою | unitLevel героя | `Character.unitLevel` |
| Смерть союзника (downed) в бою | unitLevel персонажа | `Character.unitLevel` |
| Смерть врага | worldPower | `CampaignState.worldPower` |

### 16.2. Канонический бросок уровня

```typescript
/**
 * Возвращает true, если уровень повышается на +1.
 * r — равномерное целое от 1 до 100 включительно.
 */
function rollCardLevelUp(currentLevel: number, randomInt1to100: number): boolean {
  const r = randomInt1to100
  if (currentLevel > 100) return r === 1      // P = 1%
  return r === 100 || r >= currentLevel
}
```

**Алиас:** `rollMementoLevelUp` = `rollCardLevelUp` (для L, Lm, itemLevel, unitLevel).

**Стартовый уровень:** `global_level` и `itemLevel` начинаются с **1** (не 0).

**Кривая шанса:**

| L | P(успех) |
|---|----------|
| 1 | 100% |
| 50 | 51% |
| 100 | 1% |
| >100 | 1% (только r=1) |

**Инжекция RNG:** ядро принимает `r` параметром; UI использует `Math.floor(Math.random() * 100) + 1`.

### 16.3. Применение при использовании карты

```typescript
function applyCardUse(card, r, options?: { lucky?: boolean }): CardInstance {
  card.uses_count += 1
  let leveled = rollCardLevelUp(card.global_level, r)
  if (!leveled && options?.lucky) {
    const r2 = /* новый roll */
    leveled = rollCardLevelUp(card.global_level, r2)
  }
  if (leveled) card.global_level += 1
  return card
}
```

После изменения L — `syncModSlotsForLevel` (открытие новых слотов, генерация offers).

### 16.4. Токены `%%`

**Грамматика:** одна форма на токен — `BASE%%` | `BASE%%CAP` | `BASE%%-P` (CAP>0, P>0).

**Парсер:** regex `^(-?\d+)%%(?:-(\d+)|(\d+))?$`

```typescript
function resolvePercentValue(level: number, token: string): number | null {
  // level < 0 → null
  const parsed = parsePercentToken(token)
  const L = level
  switch (parsed.kind) {
    case 'plain':
      return Math.round(parsed.base * (1 + 0.01 * L))
    case 'cap': {
      const t = Math.min(L, 100)
      return Math.round(parsed.base * (1 + (parsed.cap / 100) * (t / 100)))
    }
    case 'neg': {
      const t = Math.min(L, 100)
      return Math.round(parsed.base * (1 - (t / 100) * (parsed.p / 200)))
    }
  }
}
```

**Примеры:**

| Токен | L=0 | L=100 |
|-------|-----|-------|
| `40%%` | 40 | 80 |
| `40%%50` | 40 | 60 |
| `40%%-50` | 40 | 30 |

При L>100: `cap` и `neg` **заморожены** на значении при L=100.

### 16.5. Носители и поля L

| Носитель | Поле L | Триггер |
|----------|--------|---------|
| Умение | `global_level` | `use_card` в бою |
| Оружие | `itemLevel` | базовая атака |
| Броня/аксессуар | `itemLevel` | получение урона |
| Пассив | `global_level` | успешный proc |
| strike | — | нет L; прогресс на оружии |
| Кулаки (нет оружия) | 0 | нет прогресса, нет модов |

### 16.6. Смерть и worldPower

**Союзник downed** (конец боя victory/defeat):

```
для каждого player unit с hp === 0:
  if rollMementoLevelUp(character.unitLevel, r):
    character.unitLevel += 1
```

**Враг убит** (в бою):

```
worldPower += 1   // WORLD_POWER_PER_ENEMY_KILL
```

### 16.7. Победа — броски

**Порядок при `FINALIZE_VICTORY`:**

1. Для каждого **надетого** предмета (порядок: weapon → armor → accessory): бросок L.
2. Бросок `unitLevel` героя (с lucky retry от склонности).
3. Для каждого **filled mod slot** каждого носителя (карты, предметы, пассивы): бросок Lm.
4. Золото, дроп в сундук, codex, scenarioIndex.

**Lm бросок:** `rollMementoLevelUp(lm, r)` — независим от L.

### 16.8. Слоты модификаторов

**Вехи (production):**

```typescript
MOD_SLOT_MILESTONES = { firstThreshold: 75, step: 100 }
// slot k (0-based): L >= 75 + 100*k
// k=0 → 75, k=1 → 175, k=2 → 275, ...
```

**Вехи (development):** `{ firstThreshold: 5, step: 5 }`

```typescript
function milestoneThreshold(slotIndex: number): number {
  return firstThreshold + step * slotIndex
}

function unlockedSlotCount(carrierLevel: number): number {
  if (carrierLevel < firstThreshold) return 0
  let count = 0
  while (carrierLevel >= milestoneThreshold(count)) count++
  return count
}
```

**Состояние слота:**

```typescript
type ModSlotState =
  | { status: 'empty'; offer: ModOffer | null }
  | { status: 'filled'; templateId: string; lm: number }

type ModOffer = {
  modIds: [string, string, string] | [string, string, string, string]  // 4 при mod_offer_plus
  rollSeed: number
}
```

При пересечении вехи: новый слот `{ status: 'empty', offer: generateOffer(...) }`.

Несколько pending offers **параллельно**.

### 16.9. Генерация оффера

```typescript
function generateOffer(
  carrierTags: readonly string[],
  occupiedTemplateIds: readonly string[],
  slotIndex: number,
  seed: number,
  pool: ModTemplate[],
  offerCount: 3 | 4,
): ModOffer
```

1. Пул = моды, где `carrierTags ⊇ mod.requires` и `carrierTags ∩ mod.excludes = ∅`.
2. Исключить моды, конфликтующие с `occupiedTemplateIds` по `excludes`.
3. Случайно выбрать `offerCount` (повторения **разрешены**).
4. Детерминизм: `rollSeed` + seeded PRNG.

### 16.9.1. Удаление мода (`REMOVE_MOD`)

1. Подтверждение с текстом отката.
2. `L` носителя = `milestoneThreshold(slotIndex - 1)`, или **0** если slot 0.
   - При склонности `mod_soft_rollback`: потеря 20% прогресса **внутри текущей вехи** вместо полного отката к порогу.
3. Слот → `empty` с **новым** offer.
4. `lm` удалённого мода **теряется**.
5. Слоты с бо́льшим индексом **не затрагиваются**.

### 16.10. Масштаб эффекта мода

```
effective = base × (1 + lm / 100)   // ×2 при lm=100 для percent-ops
```

Flat-ops: по `scaleMode` в данных op.

### 16.11. Типы ModOp

```typescript
type ModOp =
  | { kind: 'damage_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'heal_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'range_add'; base: number; scaleMode: 'flat' }
  | { kind: 'cooldown_add'; base: number; scaleMode: 'flat' }
  | { kind: 'aoe_size_add'; base: number; scaleMode: 'flat' }
  | { kind: 'crit_chance_add'; base: number; scaleMode: 'percent' }
  | { kind: 'carrier_hp_add'; base: number; scaleMode: 'flat' }
  | { kind: 'defense_add'; base: number; scaleMode: 'flat' }
  | { kind: 'initiative_add'; base: number; scaleMode: 'flat' }
  | { kind: 'self_heal_on_use'; base: number; scaleMode: 'percent' }
  | { kind: 'lifesteal_pct'; base: number; scaleMode: 'percent' }
  | { kind: 'proc_extra_hit'; baseChance: number; hits: number }
  | { kind: 'reflect_on_hit'; base: number; scaleMode: 'percent' }
  | { kind: 'self_heal_on_damaged'; base: number; scaleMode: 'percent' }
  | { kind: 'aoe_center_damage_mult'; base: number; scaleMode: 'percent' }
  | { kind: 'heal_splash'; splashRatio: number; scaleMode: 'percent' }
```

### 16.12. Порядок применения в бою

1. Базовое действие (урон/лечение по L + `%%` + статы + экипировка).
2. Моды **носителя действия** (умение или оружие) — по индексу слота ascending.
3. Пассивные моды экипировки (`carrier_hp_add`, `defense_add`, `initiative_add`) — при расчёте effective stats.
4. Proc-моды экипировки при триггере (`reflect_on_hit`, `self_heal_on_damaged`).
5. Proc-моды (`proc_extra_hit`, `crit_chance_add`): **независимые** RNG; порядок слотов = порядок логов.

### 16.13. Таксономия модов

**Группы:** `damage` | `survival` | `utility` | `defense`

**Теги носителя:** `melee`, `ranged`, `aoe`, `heal`, `weapon`, `armor`, `accessory`, `attack`, `skill`, `passive`

**Фильтр:** `requires` ⊆ carrier.tags; `excludes` ∩ carrier.tags = ∅; excludes с occupied slots.

### 16.14. Два пула модов

| Пул | Количество | Носители |
|-----|------------|----------|
| `MOD_OFFER_POOL` | 23 активных (+ 6 phase-2 disabled) | карты, предметы |
| `PASSIVE_MOD_OFFER_POOL` | 12 | пассивы |

### 16.15. Lucky retry (склонности)

При `lucky_*` и провале `rollMementoLevelUp`: **один** повтор с новым `r`.

### 16.16. Обязательные unit-тесты Memento

- `rollCardLevelUp`: L=1 все r; L=100 только r=100; L>100 только r=1; L=50 r=49 fail, r=50 pass.
- `resolvePercentValue`: plain/cap/neg при L=0,100; freeze при L>100.
- `unlockedSlotCount`: пороги dev/prod.
- `generateOffer`: requires/excludes, детерминизм seed.
- `modPipeline`: damage_mult, range_add, proc_extra_hit.
- Victory: Lm rolls per filled slot; death: unitLevel on downed.

---

## 17. Объёмы контента

| Категория | Количество | Примечание |
|-----------|------------|------------|
| Игровые классы | **8** | warrior, mage, ranger, healer, rogue, paladin, warlock, berserker |
| Шаблоны умений игрока | **25** | включая `strike`; 24 в пуле дропа/магазина |
| Умения монстров/боссов | **16** | 6 monster + 10 boss exclusive |
| Виды карт (`CardKind`) | **11** | см. §6.5 |
| Пассивы героев | **32** | 8 классов × 4 |
| Пассивы врагов | **10** | |
| Архетипы врагов | **31** | 16 counter + 3 chaotic + 4 hero NPC + 8 boss |
| Боссы (ротация) | **8** | по 1 на класс |
| Расы врагов | **8** | |
| Предметы | **27** | 3 generic shop + 24 class gear (8×3) |
| Слоты экипировки | **3** | weapon, armor, accessory |
| Моды (карты/предметы) | **23** активных | каталог 29; 6 отложены |
| Моды (пассивы) | **12** | отдельный пул |
| Склонности | **15** | равный шанс при найме |
| Статические сценарии | **3** | tutorial, two-front, boss-lite |
| Цепочки экспедиций | **7** | 2 static + 5 procedural |
| Процедурные генераторы | **5** | ambush, big-arena, chaotic-map, small-skirmish, tunnel |
| Базовые статы | **9** | см. §5.1 |
| Теги (таксономия) | **25** | 14 carrier + 11 theme |
| Категории кодекса | **7** | ≈168 записей суммарно |
| Секции справки | **8** | Memento первой, default open |

### 17.1. Минимальная структура контент-заглушки

Каждый шаблон умения:

```typescript
{
  id, label, kind, maxRange, statSource,
  skillFlat, scaleToken, cooldownTurns, tags, enabled?
}
```

Каждый архетип врага:

```typescript
{
  id, label, raceId, counterClass, baseStats,
  baseAttack, skillPresets[], passivePresets[],
  skillPriorities[], spawnWeight, threatTags[]
}
```

Каждый мод:

```typescript
{
  id, label, group, requires[], excludes?,
  descriptionLines[], ops: ModOp[]
}
```

---

## 18. Критерии приёмки (чеклист)

### 18.1. Ядро

- [ ] Чистое ядро без UI-зависимостей; ≥50 unit-тестов на battle + memento + campaign
- [ ] `rollCardLevelUp` побитово совпадает с §16.2
- [ ] `resolvePercentValue` побитово совпадает с §16.4
- [ ] Автосохранение + миграция при смене version

### 18.2. Бой

- [ ] Сетка, манхэттен, 4 направления, LoS
- [ ] Initiative queue; downed исключены
- [ ] Все 11 CardKind применимы (хотя бы по 1 шаблону)
- [ ] worldPower +1 за kill
- [ ] Retry восстанавливает snapshot без дюпа наград

### 18.3. Мета

- [ ] 4 слота отряда; expedition freeze
- [ ] Downed + inter-battle revive
- [ ] Магазин 5+1 слотов; дроп 1%/10%
- [ ] Сундук + bind
- [ ] 7 expedition modes

### 18.4. Memento

- [ ] L растёт на use/hit/passive proc
- [ ] Lm растёт на victory per filled slot
- [ ] Слоты на вехах 75/175/… (prod)
- [ ] Offer 3 (или 4); pick/remove
- [ ] modPipeline в бою

### 18.5. UI

- [ ] 5 вкладок хаба + battle screen
- [ ] StatStrip + tooltips
- [ ] Кодекс 7 категорий
- [ ] Справка с Memento

---

## 19. Вне scope

- Мультиплеер, сервер, гача
- Карта мира, гексы
- Реролл mod offer за золото
- Специализация Memento (carrier preset)
- `mod-mana-save` до маны в бою
- Pathfinding A* в автобое
- Настройки стратегии AI

---

## 20. Референс

Эталонная реализация: репозиторий `gen-sp` (React 19, Ant Design 6, Zustand, Vite, Vitest).

Для сравнения клонов проверять:

1. Идентичность Memento-формул (§16).
2. Поведенческое совпадение acceptance checklist (§18).
3. Совпадение content quantities (§17).
