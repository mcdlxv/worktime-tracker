import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { employees, timeEntries } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "./errors";
import { buildReport } from "./report";
import type { Clock, TrackingService } from "./types";
import { employeeInputSchema, parseInput, periodSchema, startTimerInputSchema } from "./validation";

const russianCollator = new Intl.Collator("ru");
const byName = (a: { name: string }, b: { name: string }) =>
  russianCollator.compare(a.name, b.name);

/**
 * Did an insert hit the one_running_timer_per_employee index? SQLite names the column,
 * not the index ("UNIQUE constraint failed: time_entries.employee_id"), and that index is
 * the only unique rule on the column. Drizzle wraps the driver error, so the message is
 * looked for along the cause chain; the text is the same locally and on Turso.
 */
function isRunningTimerConflict(error: unknown): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    if (current.message.includes("UNIQUE constraint failed: time_entries.employee_id")) {
      return true;
    }
  }
  return false;
}

export function createTrackingService({
  db,
  clock = Date.now,
}: {
  db: Database;
  clock?: Clock;
}): TrackingService {
  async function requireEmployee(employeeId: number) {
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    if (!employee) throw new NotFoundError("employee");
  }

  return {
    async addEmployee(input) {
      const { name } = parseInput(employeeInputSchema, input);
      const [employee] = await db
        .insert(employees)
        .values({ name, createdAt: clock() })
        .returning();
      return employee;
    },

    async listEmployees() {
      const [rows, running] = await Promise.all([
        db.select().from(employees).orderBy(employees.id),
        db.select().from(timeEntries).where(isNull(timeEntries.endedAt)),
      ]);
      const runningByEmployee = new Map(running.map((entry) => [entry.employeeId, entry]));
      return rows
        .map((employee) => ({
          ...employee,
          runningEntry: runningByEmployee.get(employee.id) ?? null,
        }))
        .sort(byName);
    },

    async startTimer(employeeId, input) {
      const { description } = parseInput(startTimerInputSchema, input);
      await requireEmployee(employeeId);
      // No "is a timer already running?" query first: two requests could both pass it.
      // The unique index decides, and its violation becomes a domain error.
      try {
        const [entry] = await db
          .insert(timeEntries)
          .values({ employeeId, description, startedAt: clock() })
          .returning();
        return entry;
      } catch (error) {
        if (isRunningTimerConflict(error)) {
          throw new ConflictError("TIMER_ALREADY_RUNNING", "Таймер уже запущен");
        }
        throw error;
      }
    },

    async stopEntry(entryId) {
      // One statement closes the entry only while it still runs: no gap between "is it
      // running?" and "stop it", and a late repeat of the request finds nothing to stop.
      // max() keeps ended_at >= started_at when this server's clock is behind the one that
      // started the timer (a clock step back, or two hosts): the entry gets zero length
      // instead of the CHECK constraint failing.
      const [stopped] = await db
        .update(timeEntries)
        .set({ endedAt: sql`max(${clock()}, ${timeEntries.startedAt})` })
        .where(and(eq(timeEntries.id, entryId), isNull(timeEntries.endedAt)))
        .returning();
      if (stopped) return stopped;

      const [existing] = await db
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(eq(timeEntries.id, entryId))
        .limit(1);
      if (!existing) throw new NotFoundError("entry");
      throw new ConflictError("TIMER_NOT_RUNNING", "Таймер уже остановлен");
    },

    async getReport({ period, employeeId }) {
      const { from, to } = parseInput(periodSchema, period);
      if (employeeId !== undefined) await requireEmployee(employeeId);
      const now = clock();

      const [people, entries] = await Promise.all([
        db
          .select()
          .from(employees)
          .where(employeeId === undefined ? undefined : eq(employees.id, employeeId)),
        // A coarse filter the index can serve; report.ts decides exactly what belongs
        // to the period, including running entries that only count once "now" is past `from`.
        db
          .select()
          .from(timeEntries)
          .where(
            and(
              employeeId === undefined ? undefined : eq(timeEntries.employeeId, employeeId),
              lt(timeEntries.startedAt, to),
              or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, from)),
            ),
          ),
      ]);

      return buildReport({ employees: people.sort(byName), entries, period: { from, to }, now });
    },
  };
}
