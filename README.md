# Gen — клон тактической RPG

Реализация браузерной тактической RPG **Gen** по спецификации [`docs/spec.md`](docs/spec.md). Пошаговые бои на квадратной сетке, система прогресса **Memento Mori**, экспедиции, магазин/таверна, экипировка и моды.

> Продолжаете работу над проектом? Начните с [`AGENTS.md`](AGENTS.md).

**Стек:** React 19 + Ant Design 6 + Zustand 5 + Vite 6 + TypeScript + Vitest 3.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production-сборка (tsc -b + vite build)
npm test           # 111 unit/интеграционных тестов
npm run typecheck  # tsc --noEmit
npm run atlases    # пересборка спрайт-атласов (см. docs/assets.md)
```

## Профили баланса

Дефолт — **development** (быстрый прогресс: вехи модов 5/5, дроп 10%, умения в магазине 50%).
Production (вехи 75/175, дроп 1%, 3%) включается:

```bash
VITE_GAME_PROFILE=production npm run dev
```

В коде — `setProfile('production')` / `getProfile('production')`. Тесты §18.4 проверяют оба профиля.

## Архитектура (§2)

Строгое разделение слоёв; вся игровая логика — в чистом ядре без UI-зависимостей.

```
src/core/
  config.ts            профили dev/prod, лимиты, константы
  rng.ts               инжекция RNG (SeededRng детерминизм / MathRng рантайм)
  types/               доменные типы (stats, cards, battle, memento, character, content, campaign)
  memento/             НОРМАТИВНОЕ ядро §16: levels, percent, slots, mods, victory
  battle/              бой §6: geometry (манхэттен/LoS/BFS), queue, damage, engine, ai
  content/             контент-заглушки §17 (8 классов, 41 карта, 31 враг, …)
  campaign/            мета §4/§8–§12: factory, spawn, shop, tavern, chest, expedition, finalize, persistence
src/state/store.ts     Zustand: единый стейт кампании + UI-флаги сессии
src/ui/                React + AntD: HubScreen (6 вкладок), BattleScreen, InterBattleScreen
```

**Документы:** [`AGENTS.md`](AGENTS.md) (онбординг), [`docs/architecture.md`](docs/architecture.md) (слои + инварианты), [`docs/balance.md`](docs/balance.md) (балансовая модель боя — вне scope §0), [`docs/assets.md`](docs/assets.md) (атласы), [`docs/spec.md`](docs/spec.md) (нормативная спека), [`PROGRESS.md`](PROGRESS.md) (журнал реализации). Историческое — в `docs/archive/`, исследование по редизайну — в `docs/research/`.

## Что покрыто

- §16 Memento Mori — побитово (rollCardLevelUp, resolvePercentValue, вехи слотов, generateOffer, modPipeline, броски победы/смерти).
- §6 Бой — сетка, манхэттен, LoS, очередь по инициативе, downed, все 11 видов карт, worldPower, retry без дюпа.
- §17 Контент — точные объёмы (проверены тестами), ссылочная целостность.
- §3/§8–§15 Мета — хаб 5+ вкладок, магазин/таверна/сундук, 7 экспедиций, склонности, кодекс, справка, персистентность + миграции.

Проверено сквозным прогоном живого приложения (Playwright): новая игра → экспедиция → бой → победа/поражение → финализация → хаб; retry/abandon; перезагрузка с автосейвом.
