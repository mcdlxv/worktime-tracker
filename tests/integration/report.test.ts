import { describe, expect, it } from "vitest";
import { HOUR, MINUTE, useTrackingService } from "../helpers/test-context";

/** A moment in October 2026, UTC. */
const oct = (day: number, hours = 0, minutes = 0) => Date.UTC(2026, 9, day, hours, minutes);

/** 1–7 October as the half-open period [1 Oct 00:00, 8 Oct 00:00). */
const FIRST_WEEK = { from: oct(1), to: oct(8) };

describe("report for a period", () => {
  const ctx = useTrackingService();

  const addEmployee = (name: string) => ctx.service.addEmployee({ name });

  /** Tracks a task through the service; without `endedAt` the timer keeps running. */
  async function track(employeeId: number, task: string, startedAt: number, endedAt?: number) {
    ctx.clock.set(startedAt);
    await ctx.service.startTimer(employeeId, { description: task });
    if (endedAt !== undefined) {
      ctx.clock.set(endedAt);
      await ctx.service.stopTimer(employeeId);
    }
  }

  it("totals each employee separately, employees sorted by name", async () => {
    const vera = await addEmployee("Вера Образцова");
    const alia = await addEmployee("Алия Тестова");
    await track(alia.id, "Сверка накладных", oct(1, 9), oct(1, 11));
    await track(vera.id, "Звонок клиенту", oct(2, 10), oct(2, 10, 30));
    await track(alia.id, "Код-ревью", oct(3, 14), oct(3, 15));
    ctx.clock.set(oct(10));

    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(
      report.employees.map((row) => [row.employee.name, row.totalMs, row.entries.length]),
    ).toEqual([
      ["Алия Тестова", 3 * HOUR, 2],
      ["Вера Образцова", 30 * MINUTE, 1],
    ]);
    expect(report.totalMs).toBe(3.5 * HOUR);
  });

  it("includes an entry on the last day of the period", async () => {
    const alia = await addEmployee("Алия Тестова");
    await track(alia.id, "Вечерний отчёт", oct(7, 20), oct(7, 21));
    ctx.clock.set(oct(10));

    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(report.employees[0].totalMs).toBe(1 * HOUR);
  });

  it("counts only the part inside the period of entries that began before it", async () => {
    ctx.clock.set(oct(1) - 12 * HOUR);
    const alia = await addEmployee("Алия Тестова");
    const boris = await addEmployee("Борис Примеров");
    await track(alia.id, "Ночная смена", oct(1) - 2 * HOUR, oct(1) + 2 * HOUR);
    await track(boris.id, "Инвентаризация", oct(1) - 3 * HOUR);
    ctx.clock.set(oct(1) + 1 * HOUR);

    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(report.employees.map((row) => row.totalMs)).toEqual([2 * HOUR, 1 * HOUR]);
  });

  it("counts a running timer up to now and marks it as running", async () => {
    const alia = await addEmployee("Алия Тестова");
    await track(alia.id, "Сверка накладных", oct(2, 9));
    ctx.clock.set(oct(2, 10, 15));

    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(report.generatedAt).toBe(oct(2, 10, 15));
    expect(report.employees[0].entries).toEqual([
      expect.objectContaining({
        description: "Сверка накладных",
        durationMs: 75 * MINUTE,
        isRunning: true,
      }),
    ]);
  });

  it("is an empty report, with zeros rather than nulls, when nothing was tracked in it", async () => {
    ctx.clock.set(Date.UTC(2026, 8, 1));
    const alia = await addEmployee("Алия Тестова");
    await track(alia.id, "Сентябрь", Date.UTC(2026, 8, 15, 9), Date.UTC(2026, 8, 15, 17));
    await track(alia.id, "Следующая неделя", oct(9, 9), oct(9, 10));
    ctx.clock.set(oct(10));

    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(report).toEqual({
      period: FIRST_WEEK,
      generatedAt: oct(10),
      employees: [{ employee: alia, entries: [], totalMs: 0 }],
      totalMs: 0,
    });
  });

  it("is an empty report when there are no employees at all", async () => {
    const report = await ctx.service.getReport({ period: FIRST_WEEK });

    expect(report.employees).toEqual([]);
    expect(report.totalMs).toBe(0);
  });

  it("can be narrowed down to one employee", async () => {
    const alia = await addEmployee("Алия Тестова");
    const boris = await addEmployee("Борис Примеров");
    await track(alia.id, "Сверка накладных", oct(1, 10), oct(1, 11));
    await track(boris.id, "Код-ревью", oct(1, 12), oct(1, 14));
    ctx.clock.set(oct(10));

    const report = await ctx.service.getReport({ period: FIRST_WEEK, employeeId: boris.id });

    expect(report.employees.map((row) => row.employee.name)).toEqual(["Борис Примеров"]);
    expect(report.totalMs).toBe(2 * HOUR);
    await expect(
      ctx.service.getReport({ period: FIRST_WEEK, employeeId: 999 }),
    ).rejects.toMatchObject({ code: "EMPLOYEE_NOT_FOUND" });
  });

  it("rejects a period that does not start before it ends", async () => {
    await expect(
      ctx.service.getReport({ period: { from: oct(8), to: oct(1) } }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Начало периода должно быть раньше конца",
    });
    await expect(
      ctx.service.getReport({ period: { from: oct(1), to: oct(1) } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
