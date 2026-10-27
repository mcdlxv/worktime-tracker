export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "EMPLOYEE_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "TIMER_ALREADY_RUNNING"
  | "TIMER_NOT_RUNNING";

/** An expected failure with a stable code that the HTTP layer maps to a status. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, code: "VALIDATION_ERROR" | "INVALID_JSON" = "VALIDATION_ERROR") {
    super(code, message);
  }
}

const NOT_FOUND = {
  employee: { code: "EMPLOYEE_NOT_FOUND", message: "Сотрудник не найден" },
  entry: { code: "ENTRY_NOT_FOUND", message: "Запись не найдена" },
} as const;

export class NotFoundError extends DomainError {
  constructor(what: keyof typeof NOT_FOUND) {
    super(NOT_FOUND[what].code, NOT_FOUND[what].message);
  }
}

export class ConflictError extends DomainError {
  constructor(code: "TIMER_ALREADY_RUNNING" | "TIMER_NOT_RUNNING", message: string) {
    super(code, message);
  }
}
