import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { employees, timeEntries } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "./errors";
import type { Clock, TrackingService } from "./types";
import { employeeInputSchema, parseInput, startTimerInputSchema } from "./validation";

const russianCollator = new Intl.Collator("ru");

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
    if (!employee) throw new NotFoundError();
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
        .sort((a, b) => russianCollator.compare(a.name, b.name));
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

    async stopTimer(employeeId) {
      await requireEmployee(employeeId);
      // One statement finds and closes the running entry, so there is no gap between
      // "is a timer running?" and "stop it" for another request to slip into.
      const [entry] = await db
        .update(timeEntries)
        .set({ endedAt: clock() })
        .where(and(eq(timeEntries.employeeId, employeeId), isNull(timeEntries.endedAt)))
        .returning();
      if (!entry) throw new ConflictError("TIMER_NOT_RUNNING", "Таймер не запущен");
      return entry;
    },
  };
}
