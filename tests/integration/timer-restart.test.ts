import { isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { timeEntries } from "@/server/db/schema";
import { MINUTE, T0, useTrackingService } from "../helpers/test-context";

// "Повторный запуск таймера" from the assignment, in every sense it can be read.
describe("timer: starting again", () => {
  const ctx = useTrackingService();

  const addEmployee = () => ctx.service.addEmployee({ name: "Алия Тестова" });
  const runningEntries = () => ctx.db.select().from(timeEntries).where(isNull(timeEntries.endedAt));

  it("rejects a second start while the timer runs and leaves the running entry untouched", async () => {
    const employee = await addEmployee();
    const first = await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(5 * MINUTE);

    await expect(
      ctx.service.startTimer(employee.id, { description: "Звонок клиенту" }),
    ).rejects.toMatchObject({ code: "TIMER_ALREADY_RUNNING", message: "Таймер уже запущен" });

    expect(await runningEntries()).toEqual([first]);
  });

  it("starts a fresh entry once the previous one was stopped", async () => {
    const employee = await addEmployee();
    const first = await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(25 * MINUTE);
    await ctx.service.stopEntry(first.id);
    ctx.clock.advance(10 * MINUTE);

    await ctx.service.startTimer(employee.id, { description: "Звонок клиенту" });

    expect(await ctx.db.select().from(timeEntries).orderBy(timeEntries.id)).toEqual([
      expect.objectContaining({
        description: "Сверка накладных",
        startedAt: T0,
        endedAt: T0 + 25 * MINUTE,
      }),
      expect.objectContaining({
        description: "Звонок клиенту",
        startedAt: T0 + 35 * MINUTE,
        endedAt: null,
      }),
    ]);
  });

  it("lets exactly one of two simultaneous starts win, as with a double click", async () => {
    const employee = await addEmployee();

    const results = await Promise.allSettled([
      ctx.service.startTimer(employee.id, { description: "Вкладка 1" }),
      ctx.service.startTimer(employee.id, { description: "Вкладка 2" }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "TIMER_ALREADY_RUNNING" });
    expect(await runningEntries()).toHaveLength(1);
  });

  it("is enforced by the database itself, even when the service is bypassed", async () => {
    const employee = await addEmployee();
    const insertRunningEntry = async (description: string) => {
      await ctx.db
        .insert(timeEntries)
        .values({ employeeId: employee.id, description, startedAt: T0 });
    };

    await insertRunningEntry("Первая");

    await expect(insertRunningEntry("Вторая")).rejects.toMatchObject({
      // Drizzle wraps the driver's error; this is the text the service recognises.
      cause: {
        message: expect.stringContaining("UNIQUE constraint failed: time_entries.employee_id"),
      },
    });
    expect(await runningEntries()).toHaveLength(1);
  });
});
