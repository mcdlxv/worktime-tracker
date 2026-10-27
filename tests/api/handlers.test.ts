import { describe, expect, it, onTestFinished, vi } from "vitest";
import { createApiHandlers } from "@/server/http/handlers";
import type { TrackingService } from "@/server/tracking/types";
import { MINUTE, T0, useTrackingService } from "../helpers/test-context";

const BASE = "http://localhost:3000";

/** A POST with a JSON body; a string is sent as is, to test bodies that are not JSON. */
const post = (path: string, body: unknown) =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** URLSearchParams encodes "+" in an offset such as +05:00; unencoded, it would read as a space. */
const reportRequest = (query: Record<string, string>) =>
  new Request(`${BASE}/api/report?${new URLSearchParams(query)}`);

const read = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

const FIRST_WEEK = { from: "2026-10-01T00:00:00.000Z", to: "2026-10-08T00:00:00.000Z" };

describe("HTTP handlers", () => {
  const ctx = useTrackingService();
  // Built per call: useTrackingService gives every test a fresh service.
  const api = () => createApiHandlers(() => ctx.service);

  const addEmployee = async () => (await ctx.service.addEmployee({ name: "Алия Тестова" })).id;

  it("POST /api/employees creates an employee: 201", async () => {
    const response = await api().addEmployee(post("/api/employees", { name: "Алия Тестова" }));

    expect(await read(response)).toEqual({
      status: 201,
      body: { id: expect.any(Number), name: "Алия Тестова", createdAt: T0 },
    });
  });

  it("POST /api/employees with a body that is not JSON: 400 INVALID_JSON", async () => {
    const response = await api().addEmployee(post("/api/employees", "не json"));

    expect(await read(response)).toEqual({
      status: 400,
      body: { error: { code: "INVALID_JSON", message: "Тело запроса должно быть JSON" } },
    });
  });

  it("POST /api/employees with a blank name: 400 VALIDATION_ERROR", async () => {
    const response = await api().addEmployee(post("/api/employees", { name: "" }));

    expect(await read(response)).toEqual({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR", message: "Введите имя сотрудника" } },
    });
  });

  it("GET /api/employees lists employees with their running timers: 200", async () => {
    const id = await addEmployee();
    await ctx.service.startTimer(id, { description: "Сверка накладных" });

    const response = await api().listEmployees();

    expect(await read(response)).toEqual({
      status: 200,
      body: [
        {
          id,
          name: "Алия Тестова",
          createdAt: T0,
          runningEntry: expect.objectContaining({ description: "Сверка накладных", endedAt: null }),
        },
      ],
    });
  });

  it("POST /api/employees/:id/timer/start: 201, then 409 when started again", async () => {
    const id = await addEmployee();
    const start = () =>
      api().startTimer(
        post(`/api/employees/${id}/timer/start`, { description: "Сверка накладных" }),
        String(id),
      );

    expect(await read(await start())).toMatchObject({
      status: 201,
      body: { employeeId: id, description: "Сверка накладных", endedAt: null },
    });
    expect(await read(await start())).toEqual({
      status: 409,
      body: { error: { code: "TIMER_ALREADY_RUNNING", message: "Таймер уже запущен" } },
    });
  });

  it.each(["abc", "0", "-1", "1.5", "999"])(
    "POST /api/employees/%s/timer/start: 404",
    async (rawId) => {
      const response = await api().startTimer(
        post(`/api/employees/${rawId}/timer/start`, { description: "Задача" }),
        rawId,
      );

      expect(await read(response)).toEqual({
        status: 404,
        body: { error: { code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" } },
      });
    },
  );

  it("POST /api/time-entries/:id/stop: 200 with endedAt, then 409 when repeated", async () => {
    const id = await addEmployee();
    const entry = await ctx.service.startTimer(id, { description: "Сверка накладных" });
    ctx.clock.advance(30 * MINUTE);
    const stop = () =>
      api().stopEntry(post(`/api/time-entries/${entry.id}/stop`, {}), String(entry.id));

    expect(await read(await stop())).toMatchObject({
      status: 200,
      body: { id: entry.id, startedAt: T0, endedAt: T0 + 30 * MINUTE },
    });
    expect(await read(await stop())).toEqual({
      status: 409,
      body: { error: { code: "TIMER_NOT_RUNNING", message: "Таймер уже остановлен" } },
    });
  });

  it.each(["abc", "0", "999"])("POST /api/time-entries/%s/stop: 404", async (rawId) => {
    const response = await api().stopEntry(post(`/api/time-entries/${rawId}/stop`, {}), rawId);

    expect(await read(response)).toEqual({
      status: 404,
      body: { error: { code: "ENTRY_NOT_FOUND", message: "Запись не найдена" } },
    });
  });

  it("GET /api/report: 200 with totals, for one employee too, and zeros for an empty period", async () => {
    const id = await addEmployee();
    const entry = await ctx.service.startTimer(id, { description: "Сверка накладных" });
    ctx.clock.advance(30 * MINUTE);
    await ctx.service.stopEntry(entry.id);

    expect(await read(await api().getReport(reportRequest(FIRST_WEEK)))).toMatchObject({
      status: 200,
      body: { totalMs: 30 * MINUTE, employees: [{ totalMs: 30 * MINUTE }] },
    });
    expect(
      await read(await api().getReport(reportRequest({ ...FIRST_WEEK, employeeId: String(id) }))),
    ).toMatchObject({ status: 200, body: { employees: [{ employee: { id } }] } });
    expect(
      await read(
        await api().getReport(
          reportRequest({ from: "2026-11-01T00:00:00+05:00", to: "2026-11-08T00:00:00+05:00" }),
        ),
      ),
    ).toMatchObject({
      status: 200,
      body: { totalMs: 0, employees: [{ entries: [], totalMs: 0 }] },
    });
  });

  it.each([
    ["without a start", { to: FIRST_WEEK.to }, "Укажите начало и конец периода"],
    ["with a date that is not ISO 8601", { ...FIRST_WEEK, from: "вчера" }, "Некорректная дата"],
    [
      "with a time that has no offset",
      { ...FIRST_WEEK, from: "2026-10-01T00:00:00" },
      "Некорректная дата",
    ],
    [
      "that ends before it starts",
      { from: FIRST_WEEK.to, to: FIRST_WEEK.from },
      "Начало периода должно быть раньше конца",
    ],
    [
      "with an employee id that is not a number",
      { ...FIRST_WEEK, employeeId: "abc" },
      "Некорректный сотрудник",
    ],
  ])("GET /api/report %s: 400", async (_, query, message) => {
    const response = await api().getReport(reportRequest(query));

    expect(await read(response)).toEqual({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR", message } },
    });
  });

  it("answers an unexpected failure inside the service with a 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => log.mockRestore());
    const broken = {
      listEmployees: async () => {
        throw new Error("disk I/O error");
      },
    } as unknown as TrackingService;

    const response = await createApiHandlers(() => broken).listEmployees();

    expect(await read(response)).toEqual({
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка" } },
    });
  });
});
