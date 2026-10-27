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

**Правило попадания записи в период.** Конец записи `end = endedAt ?? now`. Запись входит в отчёт, если `startedAt < to` и при этом (`end > from` или `startedAt >= from`). Её вклад в период: `max(0, min(end, to) − max(startedAt, from))`. Запись нулевой длины внутри периода показывается с 0. Запись, закончившаяся ровно в `from`, в отчёт не попадает.

**Повторный старт.** `startTimer` не проверяет «нет ли уже таймера» отдельным запросом: это была бы гонка между проверкой и вставкой. Сервис просто делает INSERT и превращает нарушение индекса `one_running_timer_per_employee` в `ConflictError`. Ошибку драйвера ищем и в `err`, и в `err.cause`: Drizzle 0.45 оборачивает ошибки драйвера в `DrizzleQueryError`.

**Остановка** — один атомарный запрос: `UPDATE … SET ended_at = ? WHERE employee_id = ? AND ended_at IS NULL RETURNING *`.

---

## Этап 0 — Подготовка

### Задача 0.1: скаффолд и зависимости ✅

- [x] `npx create-next-app@latest worktime-tracker --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --empty --disable-git --yes`
- [x] `npm install next@16.3.5 drizzle-orm @libsql/client zod` и `npm install -D eslint-config-next@16.3.5 drizzle-kit vitest tsx prettier eslint-config-prettier @types/node@22`

### Задача 0.2: git и игнор-файлы

**Файлы:** создать `.gitattributes`; изменить `.gitignore`.

- [ ] `.gitattributes`: `* text=auto eol=lf`. Без этого на Windows с `core.autocrlf=true` в рабочей копии появится CRLF, и `prettier --check` упадёт.
- [ ] В `.gitignore` добавить `/data/` (локальная БД), `!.env.example`, `.claude/` (локальные настройки инструментов).
- [ ] `git init -b main` → `git add -A` → коммит `chore: scaffold Next.js 16 app with create-next-app`.

### Задача 0.3: Prettier и ESLint

**Файлы:** создать `.prettierrc.json`, `.prettierignore`; изменить `eslint.config.mjs`.

- [ ] `.prettierrc.json`: `{ "printWidth": 100 }`. Остальное по умолчанию, это совпадает со стилем скаффолда: двойные кавычки, точки с запятой.
- [ ] `.prettierignore`: `.next`, `node_modules`, `drizzle`, `data`, `package-lock.json`, `next-env.d.ts`, `AGENTS.md`, `CLAUDE.md`. Последние два генерирует `next dev`.
- [ ] `eslint.config.mjs`: последним элементом добавить `eslint-config-prettier/flat`, в `globalIgnores` — `drizzle/**`, `data/**`.
- [ ] `npm run lint` → без ошибок.

### Задача 0.4: Vitest

**Файлы:** создать `vitest.config.mts`.

- [ ] Конфиг:
  ```ts
  import { fileURLToPath } from "node:url";
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: { environment: "node", include: ["tests/**/*.test.ts"] },
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

- [ ] `npm test` → зелёный → коммит `chore: set up Prettier, Vitest and libSQL client with smoke tests`.

### Задача 0.6: npm-скрипты

**Файлы:** `package.json`.

- [ ] Добавить:
  - `typecheck: "next typegen && tsc --noEmit"`
  - `test: "vitest run"`
  - `test:watch: "vitest"`
  - `format: "prettier --write ."`
  - `format:check: "prettier --check ."`
  - `check: "npm run lint && npm run typecheck && npm test"`

  Скрипты `db:*` появятся в задаче 1.1, `test:e2e` — в 5.1.

### Задача 0.7: CI

**Файлы:** `.github/workflows/ci.yml`.

- [ ] На каждый push и PR: checkout → setup-node 22 (кэш npm) → `npm ci` → `lint` → `typecheck` → `test` → `build`.
- [ ] Коммит `ci: add GitHub Actions workflow`. Проверка — после публикации на этапе 7.

### Задача 0.8: документы

- [ ] `docs/plan.md` (этот файл), `docs/ai-log.md` (журнал ИИ), `README.md` (заготовка вместо шаблонного). Коммит `docs: add implementation plan, AI log and README skeleton`.

### Задача 0.9: проверка этапа

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build` — всё зелёное.
- [ ] `npm run dev` → http://localhost:3000 открывается. `next dev` создаёт `AGENTS.md` и `CLAUDE.md`, их коммитим: `chore: add agent docs generated by next dev`.

---

## Этап 1 — Данные и таймер (TDD)

### Задача 1.1: схема и миграции

**Файлы:** `src/server/db/schema.ts`, `drizzle.config.ts`, `scripts/migrate.ts`, изменить `src/server/db/client.ts`, `package.json`.

- [ ] Схема:
  - `employees(id, name, created_at)`;
  - `time_entries(id, employee_id → employees.id, description, started_at, ended_at NULL)`;
  - ``uniqueIndex("one_running_timer_per_employee").on(employeeId).where(sql`ended_at IS NULL`)``;
  - `index("time_entries_by_employee_start").on(employeeId, startedAt)`;
  - ``check("ended_after_started", sql`ended_at IS NULL OR ended_at >= started_at`)``.

  В `sql`-фрагментах индекса и CHECK пишем голые имена колонок: в частичном индексе SQLite допускает только колонки индексируемой таблицы.

- [ ] `drizzle.config.ts`:
  - `dialect: "turso"`, `schema: "./src/server/db/schema.ts"`, `out: "./drizzle"`;
  - `dbCredentials: { url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN }`;
  - переменные окружения загружаем через `loadEnvConfig` из `@next/env` — та же логика `.env`-файлов, что у Next.
- [ ] `client.ts`: `drizzle(client, { schema })`. Добавить `migrateDatabase(db)`: `migrate(db, { migrationsFolder: "drizzle" })` из `drizzle-orm/libsql/migrator`.
- [ ] Скрипты:
  - `db:generate: "drizzle-kit generate"`;
  - `db:migrate: "tsx scripts/migrate.ts"`;
  - `dev: "npm run db:migrate && next dev"`;
  - `start: "npm run db:migrate && next start"`.
- [ ] `npm run db:generate` → прочитать сгенерированный SQL глазами: частичный индекс должен содержать `WHERE ended_at IS NULL`.
- [ ] Коммит `feat(db): add schema with one-running-timer partial index`.

### Задача 1.2: доменные типы, ошибки, валидация

**Файлы:** `src/server/tracking/types.ts`, `errors.ts`, `validation.ts`.

- [ ] Типы — как в разделе «Контракты».
- [ ] Ошибки: `DomainError(code, message)` и наследники `ValidationError`, `NotFoundError`, `ConflictError`.
- [ ] zod-схемы:
  - `employeeInputSchema`: `name` — `trim`, длина 1–100;
  - `startTimerInputSchema`: `description` — `trim`, длина 1–200;
  - `periodSchema`: `from`, `to` — конечные числа, `from < to`;
  - `reportQuerySchema`: строки из URL → `Period` (`z.iso.datetime({ offset: true })` → `Date.parse`) + необязательный `employeeId`, положительное целое.

### Задача 1.3: тестовый контекст

**Файлы:** `tests/helpers/test-context.ts`.

- [ ] `createTestContext()` → `{ service, db, client, clock, close }`:
  - БД — временный файл: у in-memory-подключений libSQL возможны сюрпризы с отдельными соединениями, файл надёжнее и ближе к реальности;
  - перед каждым тестом выполняются миграции;
  - `clock` — фальшивые часы: `now()`, `set(ms)`, `advance(ms)`, старт `T0 = Date.UTC(2026, 9, 1, 9, 0, 0)`.

### Задача 1.4: сотрудники (TDD)

**Файлы:** `tests/integration/employees.test.ts`, `src/server/tracking/service.ts`.

- [ ] Тесты (сначала красные):
  | #   | Тест                                                 | Ожидание                                                     |
  | --- | ---------------------------------------------------- | ------------------------------------------------------------ |
  | E1  | `addEmployee({ name: "  Алия Тестова  " })`          | `{ id: число, name: "Алия Тестова", createdAt: T0 }`         |
  | E2  | добавить «Вера», «Алия», «Борис» → `listEmployees()` | порядок «Алия», «Борис», «Вера», у всех `runningEntry: null` |
  | E3  | `addEmployee({ name: "   " })`                       | `ValidationError`, в БД 0 сотрудников                        |
  | E4  | имя из 101 символа                                   | `ValidationError`                                            |
- [ ] Реализация → зелёный → коммит `feat(tracking): add and list employees`.

### Задача 1.5: старт и стоп (TDD)

**Файлы:** `tests/integration/timer.test.ts`, `service.ts`.

- [ ] Тесты:
  | #   | Тест                                                    | Ожидание                                                                                                                       |
  | --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | T3  | `startTimer(id, { description: " Сверка накладных " })` | запись `{ description: "Сверка накладных", startedAt: T0, endedAt: null }`; `listEmployees()` показывает её как `runningEntry` |
  | T4  | описание `"  "` и описание из 201 символа               | `ValidationError`, записей нет                                                                                                 |
  | T5  | `startTimer(999, …)`                                    | `NotFoundError` (`EMPLOYEE_NOT_FOUND`)                                                                                         |
  | T6  | старт, `clock.advance(25 мин)`, `stopTimer(id)`         | `endedAt = T0 + 25 мин`; `runningEntry` снова `null`                                                                           |
  | T7  | `stopTimer(id)` без запущенного таймера                 | `ConflictError` (`TIMER_NOT_RUNNING`)                                                                                          |
  | T7b | `stopTimer(999)`                                        | `NotFoundError`                                                                                                                |
  | T7c | у двух сотрудников таймеры идут одновременно            | оба запуска успешны — ограничение действует на сотрудника, а не глобально                                                      |
- [ ] Реализация → зелёный → коммит `feat(tracking): start and stop timer`.

### Задача 1.6: повторный запуск таймера (TDD)

**Файлы:** `tests/integration/timer-restart.test.ts`, `service.ts`.

- [ ] Тесты:
  | #    | Тест                                                                           | Ожидание                                                                                                         |
  | ---- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
  | T8   | старт «А», `advance(5 мин)`, старт «Б»                                         | `ConflictError` (`TIMER_ALREADY_RUNNING`). Идущая запись та же: id, «А», `startedAt: T0`; идущих записей ровно 1 |
  | T9   | старт → стоп → `advance(10 мин)` → старт                                       | две записи: первая закрыта, вторая идёт, `startedAt` второй = T0 + 25 + 10 мин                                   |
  | T10  | `Promise.allSettled([start("А"), start("Б")])`                                 | ровно один `fulfilled`, один `rejected` с `ConflictError`; в БД 1 идущая запись                                  |
  | T10b | обойти сервис: два прямых `INSERT` идущих записей одного сотрудника через `db` | второй падает: инвариант держит БД, а не только код                                                              |
- [ ] Реализация (INSERT + перевод нарушения индекса в `ConflictError`) → зелёный → коммит `feat(tracking): reject repeated timer start via unique index`.

### Задача 1.7: сохранение после перезапуска (TDD)

**Файлы:** `tests/integration/persistence.test.ts`.

- [ ] Тест T18:
  1. Сервис A на файле `<tmp>/app.db`: сотрудник, одна закрытая запись (30 мин), одна идущая.
  2. `client.close()`.
  3. Новый клиент и сервис B на том же файле, часы `+2 ч`.
  4. Проверяем: сотрудник на месте, `runningEntry` с тем же `startedAt`; `stopTimer` даёт `endedAt` по новым часам.
- [ ] Тест должен пройти без нового кода — значит, сохранение заложено в модель данных. Коммит `test(tracking): data and running timer survive restart`.

---

## Этап 2 — Отчёт (TDD)

### Задача 2.1: чистые функции отчёта

**Файлы:** `tests/unit/report.test.ts`, `src/server/tracking/report.ts`.

- [ ] Экспорт: `isInPeriod(entry, period, now)`, `overlapMs(entry, period, now)`, `buildReport({ employees, entries, period, now })`.
- [ ] Тесты. Период P = [10:00, 18:00) 1 октября, `H` — час, `M` — минута:
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
- [ ] Реализация → зелёный → коммит `feat(report): pure period overlap and report builder`.

### Задача 2.2: форматирование и период

**Файлы:** `tests/unit/format.test.ts`, `tests/unit/period.test.ts`, `src/lib/format.ts`, `src/lib/period.ts`.

- [ ] `formatDuration` (минуты округляются вниз):
  - `0` → «0 мин»
  - `59 999` → «0 мин»
  - `60 000` → «1 мин»
  - `3 725 000` → «1 ч 02 мин»
  - `7 200 000` → «2 ч 00 мин»
- [ ] `formatClock` (без ограничения 24 часами):
  - `0` → «00:00:00»
  - `3 725 000` → «01:02:05»
  - `90 000 000` → «25:00:00»
- [ ] `dayRangeToPeriod("2026-10-01", "2026-10-07")`:
  - `from` — локальная полночь 1 октября, `to` — локальная полночь **8** октября, обе как ISO-строки;
  - ожидания строим через `new Date(2026, 9, 1)`, поэтому тест не зависит от часового пояса машины;
  - `("2026-10-07", "2026-10-01")` → ошибка.
- [ ] Коммит `feat(lib): duration formatting and local day range`.

### Задача 2.3: отчёт в сервисе

**Файлы:** `tests/integration/report.test.ts`, `service.ts`.

- [ ] SQL-фильтр: `started_at < to AND (started_at >= from OR COALESCE(ended_at, now) > from)`. Точная длительность считается в `report.ts`.
- [ ] Тесты:
  | #   | Тест                                             | Ожидание                                                |
  | --- | ------------------------------------------------ | ------------------------------------------------------- |
  | R1  | 2 сотрудника, записи в периоде                   | итоги не смешиваются                                    |
  | R2  | период 1–7 октября, запись 7 октября 20:00–21:00 | входит (`to` — полночь 8 октября)                       |
  | R3  | идущий таймер                                    | учтён до `now`, `isRunning: true`                       |
  | R4  | **пустой отчёт**: записи только вне периода      | все итоги 0, `entries: []`                              |
  | R5  | **пустой отчёт**: нет сотрудников                | `employees: []`, `totalMs: 0`                           |
  | R6  | фильтр `employeeId`                              | только этот сотрудник; несуществующий → `NotFoundError` |
  | R7  | `from >= to`                                     | `ValidationError`                                       |
- [ ] Коммит `feat(report): report for a period in tracking service`.

---

## Этап 3 — HTTP API

### Задача 3.1: маппинг ошибок

**Файлы:** `tests/api/respond.test.ts`, `src/server/http/respond.ts`.

- [ ] Тесты:
  - `ValidationError` → 400;
  - `NotFoundError` → 404;
  - `ConflictError` → 409;
  - `new Error("db down")` → 500 с `INTERNAL_ERROR`, причём текст «db down» в ответ **не** попадает.
- [ ] Коммит `feat(api): map domain errors to HTTP responses`.

### Задача 3.2: обработчики

**Файлы:** `tests/api/handlers.test.ts`, `src/server/http/handlers.ts`.

- [ ] `createApiHandlers(getService)` → `{ listEmployees, addEmployee(req), startTimer(req, id), stopTimer(id), getReport(req) }`. Тесты передают `() => Promise.resolve(testService)`.
- [ ] Тесты:
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
- [ ] Коммит `feat(api): HTTP handlers for employees, timer and report`.

### Задача 3.3: маршруты и контейнер

**Файлы:**

- `src/server/http/container.ts`;
- `src/app/api/employees/route.ts`;
- `src/app/api/employees/[id]/timer/start/route.ts`;
- `src/app/api/employees/[id]/timer/stop/route.ts`;
- `src/app/api/report/route.ts`.

- [ ] `getTrackingService()`:
  - лениво открывает БД из `DATABASE_URL` / `DATABASE_AUTH_TOKEN`;
  - кэширует промис в `globalThis`, чтобы HMR в dev не плодил подключения.
- [ ] Маршруты по 3–5 строк, параметры через `ctx: RouteContext<'/api/employees/[id]/timer/start'>`.
- [ ] `npm run build`: в выводе API-маршруты помечены `ƒ` (динамические).
- [ ] Ручная проверка через `curl` по запущенному dev-серверу — примеры пойдут в README.
- [ ] Коммит `feat(api): wire route handlers`.

---

## Этап 4 — Интерфейс

### Задача 4.1: UI-кит

- [ ] `npx shadcn@latest init`, затем `add button input card table badge`. Флаги CLI сверить с `--help` на момент установки.
- [ ] `layout.tsx`:
  - `lang="ru"`, заголовок «Учёт рабочего времени»;
  - шапка с навигацией «Сотрудники» / «Отчёт».

### Задача 4.2: клиент API

**Файлы:** `src/lib/api-client.ts`.

- [ ] `getEmployees`, `addEmployee`, `startTimer`, `stopTimer`, `getReport({ from, to, employeeId? })`.
- [ ] При не-2xx бросают `ApiError(status, code, message)`. Типы ответов — из `src/server/tracking/types.ts` через `import type`.

### Задача 4.3: страница сотрудников

**Файлы:** `src/app/page.tsx`, `src/components/employees/*`, `src/components/use-now.ts`.

- [ ] `useNow(intervalMs = 1000)`: живой счётчик считается как `now − startedAt` при каждом тике, а не прибавлением секунды, — так нет дрейфа. Значение появляется только на клиенте, поэтому нет рассинхрона гидратации.
- [ ] `AddEmployeeForm`: имя, Enter отправляет форму, ошибка сервера показывается под полем.
- [ ] `EmployeeRow`:
  - **таймер не идёт:** поле «Над чем работаете?» + «Старт»;
  - **таймер идёт:** описание задачи, `formatClock(elapsed)` и «Стоп».

  Во время запроса кнопка заблокирована — это защита от двойного клика на уровне UI. Защита на уровне БД уже есть.

- [ ] Состояния: загрузка, пустой список («Добавьте первого сотрудника»), ошибка сети.

### Задача 4.4: страница отчёта

**Файлы:** `src/app/report/page.tsx`, `src/components/report/*`.

- [ ] `PeriodPicker`:
  - даты «с» и «по»;
  - пресеты «Сегодня», «Неделя» (с понедельника), «Месяц»;
  - необязательный фильтр по сотруднику.
- [ ] `ReportView`:
  - таблица «сотрудник — итог — число записей», общий итог;
  - раскрывающиеся записи: дата, начало–конец, длительность, описание, бейдж «идёт»;
  - **пустой отчёт** — «Нет записей за выбранный период».

### Задача 4.5: вымышленные данные

**Файлы:** `scripts/seed.ts`, скрипт `db:seed`.

- [ ] 4 вымышленных сотрудника и записи за последние 7 дней. Записи создаются **через сервис** с подвижными часами, так что валидация работает и для сида.
- [ ] Идемпотентность: если сотрудники уже есть, ничего не делаем. `--reset` очищает БД.

### Задача 4.6: ручная проверка

- [ ] В браузере:
  - добавить сотрудника, старт/стоп;
  - двойной клик по «Старт»;
  - две вкладки;
  - отчёт за день, неделю и месяц;
  - пустой период.
- [ ] **Перезапуск:** при идущем таймере остановить сервер → поднять → таймер продолжает идти с правильным временем.
- [ ] Найденные ошибки — в `docs/ai-log.md`, исправления отдельными коммитами `fix:`.

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
