import { describe, expect, it, onTestFinished, vi } from "vitest";
import { HttpError } from "@/server/http/errors";
import { errorResponse } from "@/server/http/respond";
import { ConflictError, NotFoundError, ValidationError } from "@/server/tracking/errors";

const read = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe("errorResponse", () => {
  it.each([
    ["a validation error", new ValidationError("Введите имя сотрудника"), 400],
    ["an unknown employee", new NotFoundError("employee"), 404],
    ["an unknown time entry", new NotFoundError("entry"), 404],
    [
      "a timer that already runs",
      new ConflictError("TIMER_ALREADY_RUNNING", "Таймер уже запущен"),
      409,
    ],
    [
      "a timer that is not running",
      new ConflictError("TIMER_NOT_RUNNING", "Таймер не запущен"),
      409,
    ],
  ])("answers %s with %i and the error's code and message", async (_, error, status) => {
    expect(await read(errorResponse(error))).toEqual({
      status,
      body: { error: { code: error.code, message: error.message } },
    });
  });

  it("answers an error of the HTTP request itself with that error's status", async () => {
    const error = new HttpError(403, "CROSS_SITE_REQUEST", "Запрос с другого сайта отклонён");

    expect(await read(errorResponse(error))).toEqual({
      status: 403,
      body: { error: { code: "CROSS_SITE_REQUEST", message: "Запрос с другого сайта отклонён" } },
    });
  });

  it("hides an unexpected error behind a 500 and logs it on the server only", async () => {
    // Drizzle puts the SQL and its parameters, user data included, into the message.
    const error = new Error(
      'Failed query: insert into "time_entries" ... params: 1,Звонок клиенту',
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => log.mockRestore());

    const response = errorResponse(error);

    expect(await read(response)).toEqual({
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка" } },
    });
    expect(log).toHaveBeenCalledWith(error);
  });
});
