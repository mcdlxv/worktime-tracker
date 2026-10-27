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

  stopTimer: (employeeId: number) => post<TimeEntry>(`/api/employees/${employeeId}/timer/stop`),

  getReport: ({ from, to, employeeId }: { from: string; to: string; employeeId?: number }) => {
    const query = new URLSearchParams({ from, to });
    if (employeeId !== undefined) query.set("employeeId", String(employeeId));
    return request<Report>(`/api/report?${query}`);
  },
};
