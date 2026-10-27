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

  it("stops the running entry at the current time", async () => {
    const employee = await addEmployee();
    const entry = await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(25 * MINUTE);

    const stopped = await ctx.service.stopEntry(entry.id);

    expect(stopped).toEqual({ ...entry, endedAt: T0 + 25 * MINUTE });
    const [listed] = await ctx.service.listEmployees();
    expect(listed.runningEntry).toBeNull();
  });

  it("ignores a late repeat of a stop, which cannot stop the timer started after it", async () => {
    // Found by hand: a stop sent while the server was down reached it after it came back.
    const employee = await addEmployee();
    const first = await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(25 * MINUTE);
    await ctx.service.stopEntry(first.id);
    ctx.clock.advance(5 * MINUTE);
    const second = await ctx.service.startTimer(employee.id, { description: "Звонок клиенту" });

    await expect(ctx.service.stopEntry(first.id)).rejects.toMatchObject({
      code: "TIMER_NOT_RUNNING",
      message: "Таймер уже остановлен",
    });

    const [listed] = await ctx.service.listEmployees();
    expect(listed.runningEntry).toEqual(second);
  });

  it("refuses to stop an entry that does not exist", async () => {
    await expect(ctx.service.stopEntry(999)).rejects.toMatchObject({
      code: "ENTRY_NOT_FOUND",
      message: "Запись не найдена",
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
