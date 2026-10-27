# Учёт рабочего времени

Небольшое веб-приложение для учёта рабочего времени сотрудников. В нём можно добавлять сотрудников, запускать таймер с описанием задачи и смотреть отчёт по каждому сотруднику за выбранный период.

> **Статус: в разработке.** План — [docs/plan.md](docs/plan.md), журнал работы с ИИ — [docs/ai-log.md](docs/ai-log.md).

## Быстрый старт

Нужен Node.js 22 или новее.

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:3000.

## Команды

| Команда                      | Что делает                                    |
| ---------------------------- | --------------------------------------------- |
| `npm run dev`                | dev-сервер                                    |
| `npm test`                   | unit- и интеграционные тесты (Vitest)         |
| `npm run check`              | ESLint, проверка типов и тесты одной командой |
| `npm run format`             | форматирование (Prettier)                     |
| `npm run build`, `npm start` | production-сборка и запуск                    |

## Стек

Next.js 16 (App Router) · TypeScript · SQLite через libSQL и Drizzle ORM · zod · Tailwind CSS · Vitest.
