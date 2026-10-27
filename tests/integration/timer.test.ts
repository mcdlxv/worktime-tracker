import { describe, expect, it } from "vitest";
import { timeEntries } from "@/server/db/schema";
import { MINUTE, T0, useTrackingService } from "../helpers/test-context";

describe("timer: start and stop", () => {
  const ctx = useTrackingService();

  const addEmployee = (name = "Алия Тестова") => ctx.service.addEmployee({ name });

  it("starts a timer with a trimmed task description", async () => {
    const employee = await addEmployee();

    const entry = await ctx.service.startTimer(employee.id, {
      description: "  Сверка накладных  ",
    });

    expect(entry).toEqual({
      id: expect.any(Number),
      employeeId: employee.id,
      description: "Сверка накладных",
      startedAt: T0,
      endedAt: null,
    });
    const [listed] = await ctx.service.listEmployees();
    expect(listed.runningEntry).toEqual(entry);
  });

  it("requires a task description of at most 200 characters", async () => {
    const employee = await addEmployee();

    await expect(ctx.service.startTimer(employee.id, { description: "   " })).rejects.toMatchObject(
      { code: "VALIDATION_ERROR", message: "Опишите задачу" },
    );
    await expect(
      ctx.service.startTimer(employee.id, { description: "з".repeat(201) }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Описание не длиннее 200 символов",
    });
    expect(await ctx.db.select().from(timeEntries)).toHaveLength(0);
  });

  it("refuses to start a timer for an unknown employee", async () => {
    await expect(ctx.service.startTimer(999, { description: "Задача" })).rejects.toMatchObject({
      code: "EMPLOYEE_NOT_FOUND",
      message: "Сотрудник не найден",
    });
  });

  it("stops the running timer at the current time", async () => {
    const employee = await addEmployee();
    await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(25 * MINUTE);

    const stopped = await ctx.service.stopTimer(employee.id);

    expect(stopped).toMatchObject({ startedAt: T0, endedAt: T0 + 25 * MINUTE });
    const [listed] = await ctx.service.listEmployees();
    expect(listed.runningEntry).toBeNull();
  });

  it("refuses to stop when no timer is running", async () => {
    const employee = await addEmployee();

    await expect(ctx.service.stopTimer(employee.id)).rejects.toMatchObject({
      code: "TIMER_NOT_RUNNING",
      message: "Таймер не запущен",
    });
  });

  it("refuses to stop a timer for an unknown employee", async () => {
    await expect(ctx.service.stopTimer(999)).rejects.toMatchObject({
      code: "EMPLOYEE_NOT_FOUND",
    });
  });

  it("lets different employees run timers at the same time", async () => {
    const alia = await addEmployee("Алия Тестова");
    const boris = await addEmployee("Борис Примеров");

    await ctx.service.startTimer(alia.id, { description: "Звонок клиенту" });
    await ctx.service.startTimer(boris.id, { description: "Код-ревью" });

    const list = await ctx.service.listEmployees();
    expect(list.map((employee) => employee.runningEntry?.description)).toEqual([
      "Звонок клиенту",
      "Код-ревью",
    ]);
  });
});
