import type { Database } from "@/server/db/client";
import { employees } from "@/server/db/schema";
import type { Clock, TrackingService } from "./types";
import { employeeInputSchema, parseInput } from "./validation";

const russianCollator = new Intl.Collator("ru");

export function createTrackingService({
  db,
  clock = Date.now,
}: {
  db: Database;
  clock?: Clock;
}): TrackingService {
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
      const rows = await db.select().from(employees).orderBy(employees.id);
      return rows
        .map((employee) => ({ ...employee, runningEntry: null }))
        .sort((a, b) => russianCollator.compare(a.name, b.name));
    },
  };
}
