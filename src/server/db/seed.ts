import { createTrackingService } from "@/server/tracking/service";
import type { Database } from "./client";
import { employees, timeEntries } from "./schema";

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

/** A workday in local time: [start hour, minute, end hour, minute]. */
const WORKDAY_SLOTS = [
  [9, 0, 11, 30],
  [12, 30, 14, 0],
  [14, 15, 17, 40],
] as const;

/**
 * Fills an empty database with the past week of weekday work for four employees.
 * Entries go through the tracking service on a moving clock, so the same validation and
 * the one-running-timer rule apply. Every entry is finished: a timer left running in a
 * demo would show days of work a week later. Does nothing if employees exist, unless
 * `reset` clears the database first.
 */
export async function seedDemoData(
  db: Database,
  { now = Date.now(), reset = false }: { now?: number; reset?: boolean } = {},
): Promise<"seeded" | "skipped"> {
  if (reset) {
    await db.delete(timeEntries);
    await db.delete(employees);
  }
  if ((await db.select({ id: employees.id }).from(employees).limit(1)).length > 0) {
    return "skipped";
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let clock = today.getTime() - 8 * 24 * 60 * 60 * 1000;
  const service = createTrackingService({ db, clock: () => clock });

  const people = [];
  for (const name of DEMO_EMPLOYEES) people.push(await service.addEmployee({ name }));

  let taskNumber = 0;
  for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
    const day = new Date(today);
    day.setDate(day.getDate() - daysAgo);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    for (const [index, employee] of people.entries()) {
      for (const [startHour, startMinute, endHour, endMinute] of WORKDAY_SLOTS) {
        // Each person starts and stops a few minutes apart, so the totals differ.
        clock = new Date(day).setHours(startHour, startMinute + index * 7);
        await service.startTimer(employee.id, {
          description: DEMO_TASKS[taskNumber++ % DEMO_TASKS.length],
        });
        clock = new Date(day).setHours(endHour, endMinute + index * 4);
        await service.stopTimer(employee.id);
      }
    }
  }
  return "seeded";
}
