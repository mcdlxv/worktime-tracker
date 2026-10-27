import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// All times are unix milliseconds (UTC). Durations are not stored: they are derived
// from started_at and ended_at, so there is nothing to get out of sync.

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    description: text("description").notNull(),
    startedAt: integer("started_at").notNull(),
    // NULL while the timer is running.
    endedAt: integer("ended_at"),
  },
  (table) => [
    // At most one running timer per employee. The database enforces it, so a double
    // click or a second browser tab cannot slip a duplicate past a check in code.
    // Bare column names: a partial index may only refer to columns of its own table.
    uniqueIndex("one_running_timer_per_employee")
      .on(table.employeeId)
      .where(sql`ended_at IS NULL`),
    index("time_entries_by_employee_start").on(table.employeeId, table.startedAt),
    check("ended_after_started", sql`ended_at IS NULL OR ended_at >= started_at`),
  ],
);
