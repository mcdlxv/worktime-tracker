import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrateDatabase, openDatabase } from "@/server/db/client";
import { useTempDir } from "../helpers/temp-dir";

describe("database migrations", () => {
  const tmp = useTempDir();

  it("create both tables and the partial unique index for running timers", async () => {
    const { client, db } = openDatabase(`file:${join(tmp.path, "app.db")}`);
    try {
      await migrateDatabase(db);

      const { rows } = await client.execute(
        `SELECT name, sql FROM sqlite_master
         WHERE name IN ('employees', 'time_entries', 'one_running_timer_per_employee')
         ORDER BY name`,
      );
      expect(rows.map((row) => row.name)).toEqual([
        "employees",
        "one_running_timer_per_employee",
        "time_entries",
      ]);
      const index = rows.find((row) => row.name === "one_running_timer_per_employee");
      expect(String(index?.sql)).toMatch(/UNIQUE INDEX .+ WHERE ended_at IS NULL/i);
    } finally {
      client.close();
    }
  });

  it("can run again on an up-to-date database, as npm run dev does on every start", async () => {
    const { client, db } = openDatabase(`file:${join(tmp.path, "app.db")}`);
    try {
      await migrateDatabase(db);
      await expect(migrateDatabase(db)).resolves.toBeUndefined();
    } finally {
      client.close();
    }
  });
});
