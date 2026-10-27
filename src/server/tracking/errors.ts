export type ErrorCode = "VALIDATION_ERROR" | "EMPLOYEE_NOT_FOUND" | "TIMER_NOT_RUNNING";

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
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

export class NotFoundError extends DomainError {
  constructor() {
    super("EMPLOYEE_NOT_FOUND", "Сотрудник не найден");
  }
}

export class ConflictError extends DomainError {
  constructor(code: "TIMER_NOT_RUNNING", message: string) {
    super(code, message);
  }
}
