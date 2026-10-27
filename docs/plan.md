# План реализации: учёт рабочего времени

> **Для исполнителя (человека или ИИ-агента).** Задачи выполняются по порядку. Код пишется по TDD: тест → убедиться, что он падает → реализация → тест зелёный → коммит. Шаги отмечены `- [ ]`.
> В плане зафиксированы контракты (типы, сигнатуры, коды ошибок), точные тест-кейсы, команды и сообщения коммитов. Сама реализация пишется в TDD-шагах. API фреймворков сверяем с документацией установленных пакетов (`node_modules/next/dist/docs/`, `.d.ts` библиотек), а не с памятью модели.

**Цель:** небольшое веб-приложение учёта рабочего времени. Умеет: сотрудники, таймер «старт/стоп» с описанием задачи, отчёт за период. Данные сохраняются после перезапуска. Есть тесты основных сценариев, включая повторный запуск таймера и пустой отчёт.

**Архитектура:** одно приложение Next.js. Состав:

- **Интерфейс** — клиентские компоненты; данные получают из REST API.
- **API** — тонкие route handlers поверх сервиса.
- **Сервис** `src/server/tracking/` — не зависит от фреймворка, получает базу и часы как зависимости.
- **Хранилище** — SQLite: локально файл, в демо Turso, тот же драйвер libSQL.

Инвариант «не больше одного идущего таймера на сотрудника» обеспечивает частичный уникальный индекс в БД.

**Стек (версии проверены при установке 27.10.2026, Node 22.16):**

| Пакет                               | Версия           | Зачем                              |
| ----------------------------------- | ---------------- | ---------------------------------- |
| next / react                        | 16.3.5 / 19.2.8  | UI + route handlers                |
| typescript                          | 5.9.3            | типы                               |
| tailwindcss                         | 4.3.3            | стили (+ shadcn/ui на этапе 4)     |
| drizzle-orm / drizzle-kit           | 0.45.4 / 0.31.11 | схема, запросы, миграции           |
| @libsql/client                      | 0.18.0           | SQLite-файл локально, Turso в демо |
| zod                                 | 4.6.7            | валидация входных данных           |
| vitest                              | 5.0.5            | unit- и интеграционные тесты       |
| tsx                                 | 4.23.15          | запуск скриптов миграции и сида    |
| prettier (+ eslint-config-prettier) | 3.9.10           | форматирование                     |
| @playwright/test                    | 1.63.0           | e2e (этап 5)                       |

## Проверенные факты (источник — установленные пакеты)

- Route handlers: `params` — это Promise. Глобальный хелпер `RouteContext<'/путь/[id]'>` даёт типизированные параметры. Типы генерируются в `next dev`, `next build`, `next typegen` (`next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).
- Route handlers по умолчанию **не кэшируются**; GET кэшируется только при явном `dynamic = 'force-static'` (`01-getting-started/15-route-handlers.md`). После `next build` проверяем, что API-маршруты помечены `ƒ`.
- `@libsql/client` и `libsql` уже входят в `serverExternalPackages` по умолчанию, настраивать бандлинг не нужно (`05-config/01-next-config-js/serverExternalPackages.md`).
- В Next 16 удалена команда `next lint`: линтер запускается через `eslint`, конфиг плоский (`02-guides/upgrading/version-16.md`).
- `layout.tsx` использует глобальный `LayoutProps<"/">`, поэтому `tsc` без предварительного `next typegen` в CI упадёт.
- drizzle-kit 0.31 поддерживает `dialect: 'turso'` (`url` + `authToken`). В `drizzle-orm/sqlite-core` есть `index().where(sql)` (частичный индекс) и `check()`. В `drizzle-orm/libsql` есть `drizzle()` и `migrator`.
- Vitest 5 экспортирует `defineConfig` из `vitest/config`; совместим с Vite 6–8.

## Карта файлов

| Файл                                                                | Ответственность                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/client.ts`                                           | `openDatabase(url, authToken?)`: создаёт папку под файл БД, клиент libSQL и Drizzle. Отдельно `migrateDatabase(db)` |
| `src/server/db/config.ts`                                           | `databaseConfig()`: откуда брать БД — `DATABASE_URL` и `DATABASE_AUTH_TOKEN` или локальный файл по умолчанию        |
| `src/server/db/schema.ts`                                           | таблицы `employees`, `time_entries`, индексы, CHECK                                                                 |
| `drizzle/`                                                          | сгенерированные SQL-миграции (коммитим)                                                                             |
| `src/server/tracking/types.ts`                                      | доменные типы и DTO                                                                                                 |
| `src/server/tracking/errors.ts`                                     | `DomainError` и наследники с кодами                                                                                 |
| `src/server/tracking/validation.ts`                                 | zod-схемы входных данных                                                                                            |
| `src/server/tracking/report.ts`                                     | чистые функции: попадание в период, обрезка по периоду, сборка отчёта                                               |
| `src/server/tracking/service.ts`                                    | `createTrackingService({ db, clock })`                                                                              |
| `src/server/http/respond.ts`                                        | ошибка → HTTP-ответ, единый формат `{ error: { code, message } }`                                                   |
| `src/server/http/handlers.ts`                                       | `createApiHandlers(getService)` — вся HTTP-логика, тестируется без сервера                                          |
| `src/server/http/container.ts`                                      | `getTrackingService()` — единственный экземпляр сервиса на процесс                                                  |
| `src/app/api/**/route.ts`                                           | тонкие обёртки: достать `params`, вызвать обработчик                                                                |
| `src/lib/format.ts`                                                 | `formatDuration`, `formatClock`                                                                                     |
| `src/lib/period.ts`                                                 | `dayRangeToPeriod` — даты из формы → границы периода в часовом поясе браузера                                       |
| `src/lib/api-client.ts`                                             | типизированные `fetch`-обёртки для UI                                                                               |
| `src/components/**`                                                 | UI-компоненты (этап 4)                                                                                              |
| `scripts/migrate.ts`, `scripts/seed.ts`                             | миграции и вымышленные данные                                                                                       |
| `tests/helpers/*`                                                   | временные БД, фальшивые часы, тестовый контекст                                                                     |
| `tests/unit/*`, `tests/integration/*`, `tests/api/*`, `tests/e2e/*` | тесты по уровням                                                                                                    |
| `docs/ai-log.md`                                                    | журнал работы с ИИ: запросы, ошибки, исправления                                                                    |

## Контракты

```ts
// src/server/tracking/types.ts — время везде в unix-миллисекундах (UTC)
export type Clock = () => number;

export interface Employee {
  id: number;
  name: string;
  createdAt: number;
}
export interface TimeEntry {
  id: number;
  employeeId: number;
  description: string;
  startedAt: number;
  endedAt: number | null; // null — таймер идёт
}
export interface EmployeeWithTimer extends Employee {
  runningEntry: TimeEntry | null;
}

export interface Period {
  from: number;
  to: number;
} // полуинтервал [from, to)

export interface ReportEntry extends TimeEntry {
  durationMs: number;
  isRunning: boolean;
} // durationMs — только часть внутри периода
export interface EmployeeReport {
  employee: Employee;
  totalMs: number;
  entries: ReportEntry[];
}
export interface Report {
  period: Period;
  generatedAt: number;
  employees: EmployeeReport[];
  totalMs: number;
}

export interface TrackingService {
  addEmployee(input: { name: string }): Promise<Employee>;
  listEmployees(): Promise<EmployeeWithTimer[]>; // по имени, ru-локаль
  startTimer(employeeId: number, input: { description: string }): Promise<TimeEntry>;
  stopTimer(employeeId: number): Promise<TimeEntry>;
  getReport(input: { period: Period; employeeId?: number }): Promise<Report>;
}
```

**Ошибки → HTTP.** Тело ответа: `{ "error": { "code": "...", "message": "..." } }`.

| Класс             | code                    | HTTP | Сообщение                                                                                                                                                                             |
| ----------------- | ----------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidationError` | `VALIDATION_ERROR`      | 400  | из zod: «Введите имя сотрудника», «Имя не длиннее 100 символов», «Опишите задачу», «Описание не длиннее 200 символов», «Начало периода должно быть раньше конца», «Некорректная дата» |
| `ValidationError` | `INVALID_JSON`          | 400  | «Тело запроса должно быть JSON»                                                                                                                                                       |
| `NotFoundError`   | `EMPLOYEE_NOT_FOUND`    | 404  | «Сотрудник не найден»                                                                                                                                                                 |
| `ConflictError`   | `TIMER_ALREADY_RUNNING` | 409  | «Таймер уже запущен»                                                                                                                                                                  |
| `ConflictError`   | `TIMER_NOT_RUNNING`     | 409  | «Таймер не запущен»                                                                                                                                                                   |
| любая другая      | `INTERNAL_ERROR`        | 500  | «Внутренняя ошибка» (детали — только в лог сервера)                                                                                                                                   |

**Правило попадания записи в период.**

- Конец записи: `end = endedAt ?? now`.
- Запись входит в отчёт при стандартном пересечении интервалов: `startedAt < to && end > from`.
- Её вклад в период: `max(0, min(end, to) − max(startedAt, from))`.
- Граничные случаи:
  - запись, закончившаяся ровно в `from`, относится к прошлому периоду;
  - запись, начавшаяся ровно в `to`, — к следующему;
  - запись нулевой длины внутри периода показывается с 0.
- Первая версия правила содержала ещё одну ветку, только для записи нулевой длины ровно в `from`. На этапе 2 её убрали: ни один тест её не требовал, а в интерфейсе такая запись практически невозможна.

**Повторный старт.** `startTimer` не проверяет «нет ли уже таймера» отдельным запросом: это была бы гонка между проверкой и вставкой. Сервис просто делает INSERT и превращает нарушение индекса `one_running_timer_per_employee` в `ConflictError`. Ошибку драйвера ищем и в `err`, и в `err.cause`: Drizzle 0.45 оборачивает ошибки драйвера в `DrizzleQueryError`.

**Остановка** — один атомарный запрос: `UPDATE … SET ended_at = ? WHERE employee_id = ? AND ended_at IS NULL RETURNING *`.

---

## Этап 0 — Подготовка

### Задача 0.1: скаффолд и зависимости ✅

- [x] `npx create-next-app@latest worktime-tracker --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --empty --disable-git --yes`
- [x] `npm install next@16.3.5 drizzle-orm @libsql/client zod` и `npm install -D eslint-config-next@16.3.5 drizzle-kit vitest tsx prettier eslint-config-prettier @types/node@22`

### Задача 0.2: git и игнор-файлы

**Файлы:** создать `.gitattributes`; изменить `.gitignore`.

- [x] `.gitattributes`: `* text=auto eol=lf`. Без этого на Windows с `core.autocrlf=true` в рабочей копии появится CRLF, и `prettier --check` упадёт.
- [x] В `.gitignore` добавить `/data/` (локальная БД), `!.env.example`, `.claude/` (локальные настройки инструментов).
- [x] `git init -b main` → коммит `aa2438b chore: scaffold Next.js 16 app and install core dependencies`. В него вошли только файлы скаффолда, поэтому следующие коммиты показывают точный дифф поверх create-next-app.

### Задача 0.3: Prettier и ESLint

**Файлы:** создать `.prettierrc.json`, `.prettierignore`; изменить `eslint.config.mjs`.

- [x] `.prettierrc.json`: `{ "printWidth": 100 }`. Остальное по умолчанию, это совпадает со стилем скаффолда: двойные кавычки, точки с запятой.
- [x] `.prettierignore`: `.next`, `node_modules`, `drizzle`, `data`, `package-lock.json`, `next-env.d.ts`, `AGENTS.md`, `CLAUDE.md`. Последние два генерирует Next.js (задача 0.9).
- [x] `eslint.config.mjs`: последним элементом добавить `eslint-config-prettier/flat`, в `globalIgnores` — `drizzle/**`, `data/**`.
- [x] `npm run lint` → без ошибок.

### Задача 0.4: Vitest

**Файлы:** создать `vitest.config.mts`.

- [x] Конфиг:
  ```ts
  import { fileURLToPath } from "node:url";
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      globalSetup: ["tests/global-setup.ts"], // общий временный корень, см. 0.5
    },
  });
  ```
  Окружение `node`: тестируем сервис и HTTP-обработчики. Интерфейс проверяет e2e на этапе 5, поэтому jsdom и React Testing Library не нужны.

### Задача 0.5: клиент БД + smoke-тесты (TDD)

**Файлы:** `tests/helpers/temp-dir.ts`, `tests/smoke/db.test.ts`, `src/server/db/client.ts`.

- [x] Временные папки:
  - хелпер `useTempDir()` выдаёт каждому тесту свою подпапку внутри общего корня прогона;
  - корень создаёт `tests/global-setup.ts` и передаёт его через `project.provide`/`inject`;
  - удаляется корень после завершения воркеров.

  Почему не удаляем сразу после теста: на Windows libSQL держит файл открытым, пока сборщик мусора не уничтожит нативные объекты выражений, поэтому удаление сразу после `client.close()` падает с `EBUSY` в непредсказуемый момент (см. `docs/ai-log.md`, ошибка №1).

- [x] Тесты:
  | #   | Тест                                                  | Ожидание                                                                                                                                           |
  | --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
  | S1  | `openDatabase("file:<tmp>/nested/dir/app.db")`        | папка `nested/dir` создана, файл БД существует                                                                                                     |
  | S2  | `SELECT 1 AS ok` через `client.execute`               | `rows[0].ok === 1`: нативный libSQL работает на этой ОС                                                                                            |
  | S3  | вставка строки со ссылкой на несуществующего родителя | `FOREIGN KEY constraint failed`. libSQL включает внешние ключи по умолчанию, в отличие от стандартного SQLite (проверено, см. ошибку №2 в журнале) |
- [x] Реализация, синхронная `openDatabase(url = DEFAULT_DATABASE_URL, authToken?)`:
  - для `file:`-URL создать родительскую папку;
  - `createClient({ url, authToken })`;
  - вернуть `{ client, db: drizzle(client) }`.

  `DEFAULT_DATABASE_URL = "file:./data/worktime.db"`.

- [x] `npm test` → зелёный → коммит `364aaea chore: set up Prettier, Vitest and the libSQL client with smoke tests`.

### Задача 0.6: npm-скрипты

**Файлы:** `package.json`.

- [x] Добавить `"engines": { "node": ">=22" }` и скрипты:
  - `typecheck: "next typegen && tsc --noEmit"`
  - `test: "vitest run"`
  - `test:watch: "vitest"`
  - `format: "prettier --write ."`
  - `format:check: "prettier --check ."`
  - `check: "npm run lint && npm run typecheck && npm test"`

  Скрипты `db:*` появятся в задаче 1.1, `test:e2e` — в 5.1.

### Задача 0.7: CI

**Файлы:** `.github/workflows/ci.yml`.

- [x] На каждый push в `main` и на каждый PR: checkout → setup-node 22 (кэш npm) → `npm ci` → `lint` → `typecheck` → `test` → `format:check` → `build`.
- [x] Коммит `a57d5d8 ci: add GitHub Actions workflow`. Сам прогон проверим после публикации на этапе 7. Нативные бинарники под Linux (libSQL, SWC, esbuild, rolldown) в lockfile уже есть.

### Задача 0.8: документы

- [x] `docs/plan.md` (этот файл), `docs/ai-log.md` (журнал ИИ), `README.md` (заготовка вместо шаблонного). Коммит `bbe2ffe docs: add implementation plan, AI log and README skeleton`.

### Задача 0.9: проверка этапа

- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build` — всё зелёное.
- [x] `npm run dev` → http://localhost:3000 открывается (200).
- [x] `AGENTS.md` и `CLAUDE.md` (ссылки на документацию, встроенную в `next`).
  - Допущение «`next dev` создаёт их сам» не подтвердилось: генератор срабатывает, только если в окружении процесса обнаружен ИИ-агент (`ensureAgentRulesForDev` в `next/dist/server/lib/app-info-log.js`).
  - Поэтому файлы созданы тем же генератором Next (`writeAgentFiles`), а не руками. `hasCurrentAgentRules` возвращает `true`, так что `next dev` их не перепишет.
  - Коммит `chore: add Next.js agent docs`.

---

## Этап 1 — Данные и таймер (TDD) ✅

Итог: 21 тест в 6 файлах. Коммиты `a0d1bb7`, `e0a4dbf`, `cdfab08`, `c34c8cb`, `2f52f5c`.

### Задача 1.1: схема и миграции ✅

**Файлы:**

- созданы: `src/server/db/schema.ts`, `src/server/db/config.ts`, `drizzle.config.ts`, `drizzle/0000_init.sql`, `scripts/migrate.ts`, `.env.example`;
- изменены: `src/server/db/client.ts`, `package.json`;
- тест: `tests/integration/schema.test.ts`.

- [x] Схема:
  - `employees(id, name, created_at)`;
  - `time_entries(id, employee_id → employees.id, description, started_at, ended_at NULL)`;
  - ``uniqueIndex("one_running_timer_per_employee").on(employeeId).where(sql`ended_at IS NULL`)``;
  - `index("time_entries_by_employee_start").on(employeeId, startedAt)`;
  - ``check("ended_after_started", sql`ended_at IS NULL OR ended_at >= started_at`)``.

  В `sql`-фрагментах индекса и CHECK пишем голые имена колонок: в частичном индексе SQLite допускает только колонки индексируемой таблицы.

- [x] `databaseConfig()` в `src/server/db/config.ts` — единственное место, где читаются `DATABASE_URL` и `DATABASE_AUTH_TOKEN`. Пустые значения заменяются значениями по умолчанию. Функция используется в `drizzle.config.ts`, в `scripts/migrate.ts`, а позже — в контейнере сервиса.
- [x] `drizzle.config.ts`: `dialect: "turso"`, `out: "./drizzle"`, `dbCredentials: databaseConfig()`. Файлы `.env` читаются через `loadEnvConfig` из `@next/env`; пакет зафиксирован в devDependencies той же версии, что и `next`.
- [x] `client.ts`: `drizzle(client, { schema })`, тип `Database` и функция `migrateDatabase(db)`.
- [x] Скрипты `db:generate` и `db:migrate`; `dev` и `start` теперь сначала применяют миграции. Проверено в браузере: `npm run dev` выводит `Database is up to date`, страница отдаёт 200.
- [x] Сгенерированный SQL прочитан: `CREATE UNIQUE INDEX one_running_timer_per_employee ON time_entries (employee_id) WHERE ended_at IS NULL`.
- [x] Тесты схемы, сначала красные:
  | #   | Тест                      | Ожидание                                                             |
  | --- | ------------------------- | -------------------------------------------------------------------- |
  | M1  | миграции на пустой БД     | обе таблицы и частичный уникальный индекс с `WHERE ended_at IS NULL` |
  | M2  | повторный запуск миграций | проходит без ошибок: `npm run dev` выполняет их при каждом старте    |
- [x] Коммит `a0d1bb7`.

### Задача 1.2: доменные типы, ошибки, валидация ✅

- [x] Типы, ошибки и zod-схемы росли вместе с тестами: каждая задача добавляла ровно то, что требовал её красный тест.
- [x] Схемы периода (`periodSchema`, `reportQuerySchema`) перенесены в этап 2, где появляется отчёт.

### Задача 1.3: тестовый контекст ✅

- [x] `useTrackingService()` → `{ service, db, client, clock, dbUrl }`: свежий файл БД с миграциями и сервис на фальшивых часах для каждого теста.
- [x] `createFakeClock()` с методами `set(ms)` и `advance(ms)`, старт `T0 = Date.UTC(2026, 9, 1, 9, 0, 0)`; константы `MINUTE` и `HOUR`.
- [x] БД в тестах — временный файл, а не `:memory:`: так ближе к реальной работе, и тот же файл нужен тесту перезапуска.

### Задача 1.4: сотрудники ✅

- [x] Тесты, сначала красные:
  | #   | Тест                                                  | Ожидание                                                                                                                 |
  | --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | E1  | `addEmployee({ name: "  Алия Тестова  " })`           | `{ id, name: "Алия Тестова", createdAt: T0 }`                                                                            |
  | E2  | «Вера», «Ёлкина», «Алия», «Борис» → `listEmployees()` | «Алия», «Борис», «Вера», «Ёлкина», у всех `runningEntry: null`. При сортировке по кодам символов «Ё» оказалась бы первой |
  | E3  | имя из пробелов                                       | `VALIDATION_ERROR` «Введите имя сотрудника», в БД пусто                                                                  |
  | E4  | имя из 100 символов / из 101 символа                  | принято / `VALIDATION_ERROR` «Имя не длиннее 100 символов»                                                               |
- [x] Коммит `e0a4dbf`.

### Задача 1.5: старт и стоп ✅

**Файлы:** `tests/integration/timer.test.ts`, `service.ts`.

- [x] Тесты:
  | #   | Тест                                                    | Ожидание                                                                                                                       |
  | --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | T3  | `startTimer(id, { description: " Сверка накладных " })` | запись `{ description: "Сверка накладных", startedAt: T0, endedAt: null }`; `listEmployees()` показывает её как `runningEntry` |
  | T4  | описание `"  "` и описание из 201 символа               | `ValidationError`, записей нет                                                                                                 |
  | T5  | `startTimer(999, …)`                                    | `NotFoundError` (`EMPLOYEE_NOT_FOUND`)                                                                                         |
  | T6  | старт, `clock.advance(25 мин)`, `stopTimer(id)`         | `endedAt = T0 + 25 мин`; `runningEntry` снова `null`                                                                           |
  | T7  | `stopTimer(id)` без запущенного таймера                 | `ConflictError` (`TIMER_NOT_RUNNING`)                                                                                          |
  | T7b | `stopTimer(999)`                                        | `NotFoundError`                                                                                                                |
  | T7c | у двух сотрудников таймеры идут одновременно            | оба запуска успешны — ограничение действует на сотрудника, а не глобально                                                      |
- [x] `stopTimer` — это один запрос `UPDATE … WHERE ended_at IS NULL RETURNING`. Коммит `cdfab08`.

### Задача 1.6: повторный запуск таймера ✅

**Файлы:** `tests/integration/timer-restart.test.ts`, `service.ts`.

- [x] Тесты:
  | #    | Тест                                                                           | Ожидание                                                                                                         |
  | ---- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
  | T8   | старт «А», `advance(5 мин)`, старт «Б»                                         | `ConflictError` (`TIMER_ALREADY_RUNNING`). Идущая запись та же: id, «А», `startedAt: T0`; идущих записей ровно 1 |
  | T9   | старт → стоп → `advance(10 мин)` → старт                                       | две записи: первая закрыта, вторая идёт, `startedAt` второй = T0 + 25 + 10 мин                                   |
  | T10  | `Promise.allSettled([start("А"), start("Б")])`                                 | ровно один `fulfilled`, один `rejected` с `ConflictError`; в БД 1 идущая запись                                  |
  | T10b | обойти сервис: два прямых `INSERT` идущих записей одного сотрудника через `db` | второй падает: инвариант держит БД, а не только код                                                              |
- [x] Красными были T8 и T10. T9 и T10b сторожат схему, поэтому прошли сразу.
- [x] Конфликт распознаётся по сообщению `UNIQUE constraint failed: time_entries.employee_id`, которое ищется по цепочке `cause`. Почему так:
  - SQLite называет в сообщении колонку, а не индекс;
  - Drizzle оборачивает ошибку драйвера в `DrizzleQueryError`.
- [x] Коммит `c34c8cb`.
- **На заметку для этапа 3:** в сообщении `DrizzleQueryError` есть параметры запроса, то есть пользовательские данные. Наружу такую ошибку отдавать нельзя, только общий ответ 500 (задача 3.1).

### Задача 1.7: сохранение после перезапуска ✅

**Файлы:** `tests/integration/persistence.test.ts`.

- [x] Тест T18:
  1. Сервис A на файле `<tmp>/app.db`: сотрудник, одна закрытая запись (30 мин), одна идущая.
  2. `client.close()`.
  3. Новый клиент и сервис B на том же файле, часы `+2 ч`.
  4. Проверяем: сотрудник на месте, `runningEntry` с тем же `startedAt`; `stopTimer` даёт `endedAt` по новым часам.
- [x] Тест прошёл без нового кода, как и ожидалось: сохранение заложено в модель данных. Он сторожит от регрессии, при которой таймеры начнут хранить в памяти процесса. Коммит `2f52f5c`.

---

## Этап 2 — Отчёт (TDD) ✅

Итог: 57 тестов в 10 файлах. Коммиты `7f30fac`, `c5a931e`, `7cd3b46`.

### Задача 2.1: чистые функции отчёта ✅

**Файлы:** `tests/unit/report.test.ts`, `src/server/tracking/report.ts`.

- [x] Экспорт: `isInPeriod(entry, period, now)`, `overlapMs(entry, period, now)`, `buildReport({ employees, entries, period, now })`.
- [x] Тесты. Период P = [10:00, 18:00) 1 октября, `H` — час, `M` — минута. Случаи O1–O6 и O9 оформлены одной таблицей `it.each`. Дополнительный тест: таймер, запущенный до периода, не попадает в отчёт, пока «сейчас» не дошло до начала периода.
  | #   | Запись                             | Ожидание                                                                              |
  | --- | ---------------------------------- | ------------------------------------------------------------------------------------- |
  | O1  | 11:00–12:30                        | входит, 1,5 H                                                                         |
  | O2  | 08:00–11:00                        | входит, 1 H (обрезано по `from`)                                                      |
  | O3  | 17:00–20:00                        | входит, 1 H (обрезано по `to`)                                                        |
  | O4  | 09:00–19:00                        | входит, 8 H                                                                           |
  | O5  | 08:00–10:00 (конец ровно в `from`) | **не** входит                                                                         |
  | O6  | начало ровно в 18:00 (`to`)        | **не** входит                                                                         |
  | O7  | идёт с 16:00, now = 17:15          | входит, 1 H 15 M, `isRunning`                                                         |
  | O8  | идёт с 16:00, now = 21:00          | входит, 2 H (обрезано по `to`)                                                        |
  | O9  | 12:00–12:00 (нулевая длина)        | входит, 0                                                                             |
  | B1  | нет сотрудников                    | `{ employees: [], totalMs: 0 }`                                                       |
  | B2  | 2 сотрудника, записей нет          | у обоих `totalMs: 0`, `entries: []`, общий итог 0 — **пустой отчёт** без `null`/`NaN` |
  | B3  | записи двух сотрудников вперемешку | разложены по сотрудникам, отсортированы по `startedAt`, итоги и общий итог верны      |
- [x] Суммы считаются в коде, а не через SQL `SUM()`: нужна обрезка по периоду, и заодно на пустом наборе получается 0, а не `NULL`. Коммит `7f30fac`.

### Задача 2.2: форматирование и период ✅

**Файлы:** `tests/unit/format.test.ts`, `tests/unit/period.test.ts`, `src/lib/format.ts`, `src/lib/period.ts`.

- [x] `formatDuration` (минуты округляются вниз):
  - `0` → «0 мин»
  - `59 999` → «0 мин»
  - `60 000` → «1 мин»
  - `3 725 000` → «1 ч 02 мин»
  - `7 200 000` → «2 ч 00 мин»
- [x] `formatClock` (без ограничения 24 часами):
  - `0` → «00:00:00»
  - `3 725 000` → «01:02:05»
  - `90 000 000` → «25:00:00»
  - отрицательное значение → «00:00:00». Так бывает, когда часы браузера отстают от серверных.
- [x] `dayRangeToPeriod`. Тесты явно задают часовой пояс через `TZ`: в CI стоит UTC, а там местная полночь совпадает с полуночью UTC, и ошибки не видны. Сверяемся с ISO-значениями, записанными в тесте вручную:
  - `("2026-10-01", "2026-10-07")` в Asia/Tashkent (UTC+5) → `2026-09-30T19:00Z … 2026-10-07T19:00Z`. Ловит `new Date("2026-10-01")`: такая запись разбирается как полночь UTC.
  - `("2026-10-25", "2026-10-25")` в Europe/Berlin даёт день длиной 25 часов: в этот день переводят часы. Ловит «+24 ч».
  - перевёрнутый диапазон, пустая строка, «2026-02-30» и «01.10.2026» → ошибка.
- [x] Мутационная проверка: наивные варианты действительно дают другие значения. Коммит `c5a931e`.

### Задача 2.3: отчёт в сервисе ✅

**Файлы:** `tests/integration/report.test.ts`, `service.ts`.

- [x] SQL-фильтр проще, чем задумывалось: `started_at < to AND (ended_at IS NULL OR ended_at > from)`. Он грубый и использует индекс; точное правило, в том числе «идущий таймер считается, только когда сейчас позже `from`», живёт в одном месте — в `report.ts`.
- [x] Тесты (плюс R1b — записи, начатые до периода: одна завершённая, одна идущая; учитывается только часть внутри периода):
  | #   | Тест                                             | Ожидание                                                |
  | --- | ------------------------------------------------ | ------------------------------------------------------- |
  | R1  | 2 сотрудника, записи в периоде                   | итоги не смешиваются                                    |
  | R2  | период 1–7 октября, запись 7 октября 20:00–21:00 | входит (`to` — полночь 8 октября)                       |
  | R3  | идущий таймер                                    | учтён до `now`, `isRunning: true`                       |
  | R4  | **пустой отчёт**: записи только вне периода      | все итоги 0, `entries: []`                              |
  | R5  | **пустой отчёт**: нет сотрудников                | `employees: []`, `totalMs: 0`                           |
  | R6  | фильтр `employeeId`                              | только этот сотрудник; несуществующий → `NotFoundError` |
  | R7  | `from >= to`                                     | `ValidationError`                                       |
- [x] Мутационная проверка: если сузить SQL-фильтр до `started_at >= from`, падает ровно тест R1b. Коммит `7cd3b46`.

---

## Этап 3 — HTTP API ✅

Итог: 80 тестов в 12 файлах. Коммиты `1abe9db`, `13315c5`, `23cae87`.

### Задача 3.1: маппинг ошибок ✅

**Файлы:** `tests/api/respond.test.ts`, `src/server/http/respond.ts`.

- [x] Тесты:
  - `ValidationError` → 400;
  - `NotFoundError` → 404;
  - оба `ConflictError` → 409;
  - неожиданная ошибка с SQL и данными пользователя в сообщении (как у `DrizzleQueryError`) → 500 `INTERNAL_ERROR`. Сообщение в ответ **не** попадает и пишется только в серверный лог (`console.error`).
- [x] Статусы задаёт `Record<ErrorCode, number>`. При добавлении `INVALID_JSON` проверка типов упала, пока коду не дали статус: так и было задумано. Коммит `1abe9db`.

### Задача 3.2: обработчики ✅

**Файлы:** `tests/api/handlers.test.ts`, `src/server/http/handlers.ts`.

- [x] `createApiHandlers(getService)` → `{ listEmployees, addEmployee(req), startTimer(req, id), stopTimer(id), getReport(req) }`.
  - `getService` синхронный: открыть БД — синхронная операция, а асинхронность здесь ничего не дала бы (YAGNI).
  - Тесты передают `() => ctx.service`.
- [x] Разбор query для отчёта находится в HTTP-слое: строки из URL переводятся в `Period`.
  - `from` и `to` — ISO 8601 со смещением. Время без смещения неоднозначно, поэтому отклоняется.
  - `employeeId` — положительное целое.
  - Сообщения на русском.
  - API zod 4 (`z.iso.datetime`, параметр `error`) сначала проверены на живых значениях.
- [x] Тесты (A6 расширен до `abc`, `0`, `-1`, `1.5`, `999`; A9 — пять случаев, включая время без смещения и нечисловой `employeeId`; плюс сбой внутри сервиса → 500):
  | #   | Запрос                                                       | Ожидание                                  |
  | --- | ------------------------------------------------------------ | ----------------------------------------- |
  | A1  | POST employees `{ name: "Алия" }`                            | 201, `name: "Алия"`                       |
  | A2  | POST employees, тело `не json`                               | 400 `INVALID_JSON`                        |
  | A3  | POST employees `{ name: "" }`                                | 400 `VALIDATION_ERROR`                    |
  | A4  | GET employees                                                | 200, массив с `runningEntry`              |
  | A5  | POST start дважды                                            | 201, затем 409 `TIMER_ALREADY_RUNNING`    |
  | A6  | POST start для id `abc` и `999`                              | 404                                       |
  | A7  | POST stop без таймера / после старта                         | 409 `TIMER_NOT_RUNNING` / 200 с `endedAt` |
  | A8  | GET report с валидным периодом / пустым периодом             | 200 с итогами / 200, `totalMs: 0`         |
  | A9  | GET report без `from`, с мусором вместо даты, с `from >= to` | 400                                       |
- [x] Коммит `13315c5`.

### Задача 3.3: маршруты и контейнер ✅

**Файлы:**

- `src/server/http/container.ts`;
- `src/app/api/employees/route.ts`;
- `src/app/api/employees/[id]/timer/start/route.ts`;
- `src/app/api/employees/[id]/timer/stop/route.ts`;
- `src/app/api/report/route.ts`.

- [x] `getTrackingService()`:
  - лениво открывает БД из `databaseConfig()`;
  - держит сервис в `globalThis`, чтобы горячая перезагрузка в dev не открывала новое подключение к БД.
- [x] Маршруты по 3–5 строк, параметры через `ctx: RouteContext<'/api/employees/[id]/timer/start'>`.
- [x] `npm run build`: все четыре API-маршрута помечены `ƒ` (динамические), в том числе `GET /api/employees`, который не читает запрос.
- [x] Живая проверка запущенного dev-сервера:
  - каждый эндпоинт вернул ожидаемый статус, в том числе 409 на повторный старт;
  - пустой отчёт за сентябрь отдал нули;
  - итог за октябрь совпал с разницей между стопом и стартом.
- [x] **Найдено вживую.** Незакодированный `+` в смещении (`?from=…+05:00`) читается как пробел → 400. Наш клиент отправляет время с `Z` (`toISOString()`), а в README для `curl` нужен `--data-urlencode`.
- [x] После проверки dev-база удалена, чтобы сид на этапе 4 начинал с чистой БД. Коммит `23cae87`.
- **На заметку для README:** скрипты (`db:migrate`) читают `.env` через `loadEnvConfig` в режиме production, а `next dev` — в режиме development. Чтобы оба видели одни и те же переменные, Turso-настройки держим в `.env.local`: он загружается в обоих режимах.

### Задача 3.4: защита изменяющих запросов от межсайтовых вызовов ✅

Задачи не было в плане. Её добавили после автоматического ревью безопасности и решения человека (подробности в `docs/ai-log.md`, ошибка № 5).

**Файлы:** `src/server/http/errors.ts`, `src/server/http/handlers.ts`, `src/server/http/respond.ts`, `src/app/api/employees/[id]/timer/stop/route.ts`, `tests/api/request-guard.test.ts`.

- [x] Тесты (сначала красные; межсайтовый запрос и `text/plain` получали 201):
  | #   | Запрос                                                      | Ожидание                               |
  | --- | ----------------------------------------------------------- | -------------------------------------- |
  | C1  | POST employees с `Sec-Fetch-Site: cross-site` / `same-site` | 403 `CROSS_SITE_REQUEST`, БД пуста     |
  | C2  | `Sec-Fetch-Site: same-origin` / без заголовка (curl)        | 201                                    |
  | C3  | POST employees с `Content-Type: text/plain`                 | 415 `UNSUPPORTED_MEDIA_TYPE`, БД пуста |
  | C4  | `Content-Type: application/json; charset=utf-8`             | 201                                    |
  | C5  | старт и стоп с `cross-site`, стоп без `Content-Type`        | 403, 403, 415; таймер не тронут        |
- [x] `HttpError(status, code, message)` для ошибок самого HTTP-запроса, чтобы доменный слой не знал про HTTP. `stopTimer` теперь принимает запрос, чтобы читать заголовки. Коммит `cecaf55`.
- **Для этапа 4:** клиент API отправляет `Content-Type: application/json` в **каждом** изменяющем запросе, включая стоп без тела.
- **Вне объёма по ТЗ:** вход, роли, права на уровне сотрудника. В README они пойдут в раздел «Безопасность» как то, что нужно для продакшена.

---

## Этап 4 — Интерфейс ✅

Итог: 104 теста в 15 файлах. Коммиты `1b4d440`, `a8f4577`, `d15d884`, `35e3677`, `b0ca26c`.

### Задача 4.1: UI-кит и каркас ✅

- [x] **Отступление от плана: вместо shadcn/ui — два своих примитива** (`Button`, `TextInput` в `src/components/ui.tsx`). Интерфейсу больше ничего не нужно. Даты, фильтр и раскрывающиеся строки сделаны на нативных `<input type="date">`, `<select>` и `<details>`, которые доступны с клавиатуры и для скринридеров без библиотек. Сгенерированного кода в репозитории нет.
- [x] Дизайн «учётная книга»:
  - строки разделены линейками, без карточек;
  - итог под двойной чертой;
  - один акцент — «лампа» (`#B45309`) у идущего таймера;
  - шрифт IBM Plex Sans/Mono (IBM выросла и из производителей табельных часов) подключён через npm (`@fontsource`), поэтому при сборке ничего не скачивается.
- [x] `layout.tsx`: `lang="ru"`, заголовок «Табель — учёт рабочего времени», шапка с навигацией и `aria-current` у текущего раздела.

### Задача 4.2: клиент API ✅

**Файлы:** `src/lib/api-client.ts`, `tests/unit/api-client.test.ts`.

- [x] `apiClient.listEmployees`, `addEmployee`, `startTimer`, `stopTimer`, `getReport`.
  - Каждый изменяющий запрос, **включая стоп**, отправляется как JSON (требование задачи 3.4).
  - Ответ с ошибкой превращается в `ApiError(status, code, message)`; сбой сети — в `NETWORK_ERROR` с понятным текстом. `describeError` выбирает текст для показа.
- [x] Плюс TDD-функции для формы отчёта:
  - `presetRange` — сегодня, неделя с понедельника (в том числе через границу месяца), месяц;
  - `toLocalDateString`;
  - `formatDate` и `formatTime` в поясе браузера. Тест идёт в Europe/Berlin, а не в UTC+5 этой машины.

### Задача 4.3: страница сотрудников ✅

- [x] `useNow`: прошедшее время считается как `now − startedAt` на каждом тике.
- [x] Форма добавления.
  - Тексты ошибок приходят с сервера, поэтому правила валидации описаны в одном месте.
  - Ошибка исчезает, как только поле начинают править.
- [x] Строка сотрудника.
  - Пока идёт таймер, строка «горит»: видны описание задачи, время начала, живые часы и кнопка «Остановить».
  - На время запроса кнопка заблокирована.
  - После любого ответа, включая 409, список перечитывается. Если таймер уже запустили в другой вкладке, сразу видно, что происходит на самом деле.
- [x] Список перечитывается при возврате фокуса в окно.
- [x] Состояния: «Загрузка…», пустой список, ошибка сети с кнопкой «Повторить».
- [x] Правило ESLint из React Compiler (`set-state-in-effect`) не пропустило `setState` внутри эффекта. Теперь `reload` задаёт состояние только в колбэках промиса.

### Задача 4.4: страница отчёта ✅

- [x] `PeriodPicker`: даты «с» и «по», пресеты «Сегодня», «Эта неделя» и «Этот месяц» (у активного `aria-pressed`), фильтр по сотруднику.
- [x] `ReportTable`: у каждого сотрудника итог и число записей, строка раскрывается в список записей (`<details>`). Ниже двойная черта и общий итог.
  - **Пустой период:** «За этот период ничего не записано.», в итогах нули.
  - **Нет сотрудников:** подсказка, где их добавить.
- [x] Что предусмотрено заранее:
  - **Гидратация.** Период по умолчанию зависит от даты в браузере, а сервер в UTC после местной полуночи видит другой день. Поэтому форма рендерится только на клиенте (`useIsClient` на `useSyncExternalStore`).
  - **Гонка ответов.** Если ответ пришёл на уже устаревший запрос, он игнорируется.
  - **Неверный диапазон дат** вычисляется при рендере, запрос с ним не отправляется.
  - **«Повторить»** создаёт новый ключ запроса, поэтому вместо старой ошибки сразу появляется «Считаю…».

### Задача 4.5: вымышленные данные ✅

**Файлы:** `src/server/db/seed.ts`, `scripts/seed.ts`, `tests/integration/seed.test.ts`, скрипт `db:seed`.

- [x] Четыре вымышленных сотрудника (Тестова, Примеров, Образцова, Пробный), только будни прошлой недели, задачи из логистики и диспетчеризации.
- [x] Записи создаются через сервис на подвижных часах. Все записи завершены: таймер, оставшийся идти в демо, через неделю показывал бы сотни часов.
- [x] Повторный запуск ничего не меняет, `--reset` начинает заново. Тесты подтверждают все три поведения.

### Задача 4.6: ручная проверка ✅

- [x] В браузере: добавление, пустое имя, старт и стоп, «другая вкладка» с 409 и обновлением строки, отчёт за неделю и месяц, фильтр по сотруднику, пустой период, перевёрнутый диапазон, мобильная ширина 375 px.
- [x] **Перезапуск по-настоящему.**
  - Процесс сервера остановлен: порт 3000 свободен, запрос из браузера падает с `Failed to fetch`.
  - После повторного запуска таймер продолжает идти: тот же `startedAt`, на часах `00:01:23` спустя 84 с после старта.
- [x] Найдено и исправлено — подробности в `docs/ai-log.md`:
  - на телефоне «горящая» строка уходила на 107 px за край экрана (ошибка № 6);
  - строка записи в отчёте выходила за край на 4 px;
  - скринридер читал имя и цифры слитно;
  - ошибка не исчезала после правки поля;
  - после потери связи нечем было повторить запрос.
- [ ] **Открытый вопрос.** Стоп, нажатый при лежащем сервере, сработал позже, уже после его запуска. Запрос доставили повторно — прокси панели браузера или сам браузер. Это показало, что `POST /timer/stop` не привязан к записи: опоздавший или повторный стоп остановил бы уже новый таймер. Предложение — стоп по `entryId`, ответ 409, если эта запись уже закрыта. Решает владелец.

---

## Этап 5 — Проверка и ревью

### Задача 5.1: e2e

- [ ] `npm install -D @playwright/test`. Браузеры лежат в `PLAYWRIGHT_BROWSERS_PATH=C:\pw-browsers`.
- [ ] `playwright.config.ts`:
  - `webServer` поднимает приложение на отдельной БД `file:./data/e2e.db`;
  - БД удаляется перед прогоном.
- [ ] `tests/e2e/time-tracking.spec.ts` (T19): добавить сотрудника → старт с описанием → стоп → в отчёте за сегодня есть запись и итог.
- [ ] Скрипт `test:e2e`; в CI добавить шаг `npx playwright install --with-deps chromium && npm run test:e2e`.

### Задача 5.2: независимое ревью

- [ ] Ревью свежим агентом без контекста разработки (`/code-review`). По желанию — вторая модель другого семейства.
- [ ] Каждая подтверждённая находка:
  - тест, который её воспроизводит;
  - исправление отдельным коммитом;
  - строка в таблице ошибок `docs/ai-log.md`.

### Задача 5.3: чистый клон

- [ ] `git clone` во временную папку → `npm ci` → `npm run check` → `npm run dev`: всё работает по инструкции из README без дополнительных шагов.

---

## Этап 6 — README

- [ ] Разделы:
  - что это (скриншот на вымышленных данных, демо, бейдж CI);
  - быстрый старт;
  - требования ТЗ ↔ тесты;
  - устройство: стек, структура, модель данных, API с `curl`, ключевые решения;
  - тесты;
  - **как использовался ИИ**: инструменты и модели и почему они; процесс; 4–6 запросов дословно; найденные и исправленные ошибки со ссылками на коммиты;
  - ограничения и что улучшить;
  - пометка «все данные вымышленные».
- [ ] Коммит `docs: complete README`.

## Этап 7 — Публикация и демо

Каждое внешнее действие — только с явного «да» владельца репозитория.

- [ ] Перед публикацией проверить автора коммитов (`git log --format='%an <%ae>'`); при желании заменить почту на GitHub noreply, пока история не опубликована.
- [ ] Публичный репозиторий на GitHub, push, CI зелёный.
- [ ] Turso: база через интеграцию Vercel Marketplace. Миграции: `DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate`, затем сид.
- [ ] Vercel: проект, переменные `DATABASE_URL` и `DATABASE_AUTH_TOKEN`, деплой.
- [ ] Проверить демо в браузере, ссылку добавить в README.

---

## Самопроверка: ТЗ → задачи

| Требование                                        | Задачи                                |
| ------------------------------------------------- | ------------------------------------- |
| Добавление сотрудников                            | 1.4, 3.2 (A1–A4), 4.3                 |
| Старт/стоп с описанием задачи                     | 1.5, 3.2 (A5–A7), 4.3                 |
| Записи и общее время каждого сотрудника за период | 2.1–2.3, 3.2 (A8–A9), 4.4             |
| Сохранение после перезапуска                      | 1.7, 4.6                              |
| Тест повторного запуска таймера                   | 1.6 (T8–T10b), 3.2 (A5)               |
| Тест пустого отчёта                               | 2.1 (B1–B2), 2.3 (R4–R5), 3.2 (A8)    |
| Простой интерфейс без авторизации                 | этап 4                                |
| Только вымышленные данные                         | 4.5, проверка перед этапом 7          |
| README: запуск, ИИ, запросы, ошибки               | 0.8, этап 6, `docs/ai-log.md` по ходу |
| Публичный репозиторий, демо                       | этап 7                                |
