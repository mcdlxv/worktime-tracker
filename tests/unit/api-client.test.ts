import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, describeError } from "@/lib/api-client";

/** Replaces fetch with a stub that answers every call with the given status and body. */
function stubFetch(status: number, body: unknown) {
  const fetchStub = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

/** The URL and the options of the stub's only call. */
const onlyCall = (fetchStub: ReturnType<typeof stubFetch>) => {
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit | undefined];
  return { url, init };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient", () => {
  it.each([
    ["adding an employee", () => apiClient.addEmployee("Алия Тестова"), { name: "Алия Тестова" }],
    [
      "starting a timer",
      () => apiClient.startTimer(7, "Сверка накладных"),
      { description: "Сверка накладных" },
    ],
    ["stopping a timer", () => apiClient.stopTimer(7), {}],
  ])("sends %s as a JSON POST, as the API requires", async (_, call, body) => {
    const fetchStub = stubFetch(200, {});

    await call();

    const { init } = onlyCall(fetchStub);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it("encodes the period in the report URL, the + of an offset included", async () => {
    const fetchStub = stubFetch(200, {});

    await apiClient.getReport({
      from: "2026-10-01T00:00:00+05:00",
      to: "2026-10-08T00:00:00+05:00",
      employeeId: 3,
    });

    const { url } = onlyCall(fetchStub);
    expect(url).toBe(
      "/api/report?from=2026-10-01T00%3A00%3A00%2B05%3A00&to=2026-10-08T00%3A00%3A00%2B05%3A00&employeeId=3",
    );
  });

  it("turns an error response into an ApiError with the server's code and message", async () => {
    stubFetch(409, { error: { code: "TIMER_ALREADY_RUNNING", message: "Таймер уже запущен" } });

    await expect(apiClient.startTimer(7, "Задача")).rejects.toEqual(
      new ApiError(409, "TIMER_ALREADY_RUNNING", "Таймер уже запущен"),
    );
  });

  it("reports a network failure in plain words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(apiClient.listEmployees()).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Нет связи с сервером. Проверьте, что приложение запущено, и попробуйте ещё раз.",
    });
  });
});

describe("describeError", () => {
  it("shows the server's message for an API error and a plain hint for anything else", () => {
    expect(describeError(new ApiError(409, "TIMER_ALREADY_RUNNING", "Таймер уже запущен"))).toBe(
      "Таймер уже запущен",
    );
    expect(describeError(new TypeError("x is undefined"))).toBe(
      "Что-то пошло не так. Обновите страницу и попробуйте ещё раз.",
    );
  });
});
