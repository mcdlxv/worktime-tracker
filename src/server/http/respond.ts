import { DomainError, type ErrorCode } from "@/server/tracking/errors";

// A Record, so a new error code without a status does not compile.
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  EMPLOYEE_NOT_FOUND: 404,
  TIMER_ALREADY_RUNNING: 409,
  TIMER_NOT_RUNNING: 409,
};

/** Turns an error into `{ error: { code, message } }` with the matching HTTP status. */
export function errorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS_BY_CODE[error.code] },
    );
  }
  // Anything unexpected stays on the server: such messages can carry SQL and user data.
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка" } },
    { status: 500 },
  );
}
