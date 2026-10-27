import type { Employee, EmployeeWithTimer, Report, TimeEntry } from "@/server/tracking/types";

/** A failed API call, with the server's error code and a message to show as is. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The text to show for a failed call. */
export function describeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Что-то пошло не так. Обновите страницу и попробуйте ещё раз.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Нет связи с сервером. Проверьте, что приложение запущено, и попробуйте ещё раз.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "UNKNOWN_ERROR",
      body?.error?.message ?? "Сервер ответил ошибкой. Попробуйте ещё раз.",
    );
  }
  if (body === null) {
    // A success that is not JSON comes from something in between, such as the sign-in
    // page of a proxy; passing it on as data would crash the page that reads it.
    throw new ApiError(
      response.status,
      "BAD_RESPONSE",
      "Сервер ответил не так, как ожидалось. Обновите страницу.",
    );
  }
  return body as T;
}

/** Every request that changes data goes out as JSON: the API refuses anything else. */
const post = <T>(path: string, body: object = {}) =>
  request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const apiClient = {
  listEmployees: () => request<EmployeeWithTimer[]>("/api/employees"),

  addEmployee: (name: string) => post<Employee>("/api/employees", { name }),

  startTimer: (employeeId: number, description: string) =>
    post<TimeEntry>(`/api/employees/${employeeId}/timer/start`, { description }),

  /** Stops this very entry: a repeated or late request cannot stop a newer timer. */
  stopEntry: (entryId: number) => post<TimeEntry>(`/api/time-entries/${entryId}/stop`),

  getReport: ({ from, to, employeeId }: { from: string; to: string; employeeId?: number }) => {
    const query = new URLSearchParams({ from, to });
    if (employeeId !== undefined) query.set("employeeId", String(employeeId));
    return request<Report>(`/api/report?${query}`);
  },
};
