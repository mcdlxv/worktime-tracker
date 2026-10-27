export type ErrorCode = "VALIDATION_ERROR";

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
