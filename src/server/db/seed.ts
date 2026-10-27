import { createTrackingService } from "@/server/tracking/service";
import type { Database } from "./client";
import { employees, timeEntries } from "./schema";
import { addDays, calendarDate, wallClockTime } from "./wall-clock";

// Made-up people: the surnames literally mean "test", "example", "sample" and "trial".
const DEMO_EMPLOYEES = ["Алия Тестова", "Борис Примеров", "Вера Образцова", "Данияр Пробный"];

const DEMO_TASKS = [
  "Сверка накладных",
  "Планирование маршрутов",
  "Звонки перевозчикам",
  "Разбор новых заявок",
  "Проверка документов водителей",
  "Созвон с клиентом",
  "Обновление тарифов",
  "Подготовка недельного отчёта",
];

/** A workday on the wall clock: [start hour, minute, end hour, minute]. */
const WORKDAY_SLOTS = [
  [9, 0, 11, 30],
  [12, 30, 14, 0],
  [14, 15, 17, 40],
] as const;

/**
 * The time zone of the public demo's workday. The build seeds in it through TZ (vercel.json)
 * and the daily reset passes it explicitly, since Vercel functions always run in UTC.
 */
export const DEMO_TIME_ZONE = "Europe/Moscow";

/**
 * Fills an empty database with the past week of weekday work for four employees, laid out
 * on the wall clock of `timeZone` (by default the machine's own). Entries go through the
 * tracking service on a moving clock, so the same validation and the one-running-timer rule
 * apply. Every entry is finished: a timer left running in a demo would show days of work a
 * week later. Does nothing if employees exist, unless `reset` clears the database first.
 */
export async function seedDemoData(
  db: Database,
  {
    now = Date.now(),
    reset = false,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  }: { now?: number; reset?: boolean; timeZone?: string } = {},
): Promise<"seeded" | "skipped"> {
  if (reset) {
    await db.delete(timeEntries);
    await db.delete(employees);
  }
  if ((await db.select({ id: employees.id }).from(employees).limit(1)).length > 0) {
    return "skipped";
  }

  const today = calendarDate(now, timeZone);
  let clock = wallClockTime({ ...addDays(today, -8), hour: 0, minute: 0 }, timeZone);
  const service = createTrackingService({ db, clock: () => clock });

  const people = [];
  for (const name of DEMO_EMPLOYEES) people.push(await service.addEmployee({ name }));

  let taskNumber = 0;
  for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
    const day = addDays(today, -daysAgo);
    if (day.weekday === 0 || day.weekday === 6) continue;

    for (const [index, employee] of people.entries()) {
      for (const [startHour, startMinute, endHour, endMinute] of WORKDAY_SLOTS) {
        // Each person starts and stops a few minutes apart, so the totals differ.
        clock = wallClockTime(
          { ...day, hour: startHour, minute: startMinute + index * 7 },
          timeZone,
        );
        const entry = await service.startTimer(employee.id, {
          description: DEMO_TASKS[taskNumber++ % DEMO_TASKS.length],
        });
        clock = wallClockTime({ ...day, hour: endHour, minute: endMinute + index * 4 }, timeZone);
        await service.stopEntry(entry.id);
      }
    }
  }
  return "seeded";
}
