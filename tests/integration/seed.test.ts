import { describe, expect, it } from "vitest";
import { employees, timeEntries } from "@/server/db/schema";
import { seedDemoData } from "@/server/db/seed";
import { HOUR, useTrackingService } from "../helpers/test-context";

const DAY = 24 * HOUR;
/** Wednesday, 28 October 2026, noon local time. */
const NOW = new Date(2026, 9, 28, 12, 0).getTime();

describe("demo data", () => {
  const ctx = useTrackingService();

  it("adds four employees and finished weekday entries from the past week", async () => {
    expect(await seedDemoData(ctx.db, { now: NOW })).toBe("seeded");

    const people = await ctx.db.select().from(employees);
    const entries = await ctx.db.select().from(timeEntries);
    expect(people).toHaveLength(4);
    expect(new Set(entries.map((entry) => entry.employeeId)).size).toBe(4);
    for (const entry of entries) {
      expect(entry.endedAt).not.toBeNull();
      expect(entry.endedAt!).toBeLessThan(NOW);
      expect(entry.startedAt).toBeGreaterThan(NOW - 8 * DAY);
      expect([0, 6]).not.toContain(new Date(entry.startedAt).getDay());
    }
  });

  it("leaves existing data alone when run again", async () => {
    await seedDemoData(ctx.db, { now: NOW });
    const countBefore = (await ctx.db.select().from(timeEntries)).length;

    expect(await seedDemoData(ctx.db, { now: NOW })).toBe("skipped");

    expect(await ctx.db.select().from(employees)).toHaveLength(4);
    expect(await ctx.db.select().from(timeEntries)).toHaveLength(countBefore);
  });

  it("lays the workday out in the given time zone, whatever the machine's own", async () => {
    // Wednesday, 28 October 2026, noon in Moscow (UTC+3). Vercel runs functions in UTC, and
    // this machine and CI run in other zones, so a seed that used local time would not match.
    const now = Date.UTC(2026, 9, 28, 9, 0);

    await seedDemoData(ctx.db, { now, timeZone: "Europe/Moscow" });

    const entries = await ctx.db.select().from(timeEntries);
    const earliest = Math.min(...entries.map((entry) => entry.startedAt));
    // A week back is Wednesday, 21 October; the first entry starts at 09:00 Moscow time.
    expect(earliest).toBe(Date.UTC(2026, 9, 21, 6, 0));
    for (const entry of entries) {
      const weekday = new Date(entry.startedAt + 3 * HOUR).getUTCDay();
      expect([0, 6]).not.toContain(weekday);
    }
  });

  it("starts over when asked to reset", async () => {
    await ctx.service.addEmployee({ name: "Посторонний" });

    expect(await seedDemoData(ctx.db, { now: NOW, reset: true })).toBe("seeded");

    const names = (await ctx.db.select().from(employees)).map((employee) => employee.name);
    expect(names).toHaveLength(4);
    expect(names).not.toContain("Посторонний");
  });
});
