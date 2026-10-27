import { z } from "zod";
import { NotFoundError, ValidationError } from "@/server/tracking/errors";
import type { TrackingService } from "@/server/tracking/types";
import { parseInput } from "@/server/tracking/validation";
import { errorResponse } from "./respond";

/** An ISO 8601 instant with an explicit offset ("…Z" or "…+05:00"), as unix milliseconds. */
const instant = z
  .string({ error: "Укажите начало и конец периода" })
  .pipe(z.iso.datetime({ offset: true, error: "Некорректная дата" }))
  .transform((value) => Date.parse(value));

const reportQuerySchema = z.object({
  from: instant,
  to: instant,
  employeeId: z.coerce
    .number({ error: "Некорректный сотрудник" })
    .int("Некорректный сотрудник")
    .positive("Некорректный сотрудник")
    .optional(),
});

/** A body that is not JSON is the client's mistake: 400, not a crash. */
async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Тело запроса должно быть JSON", "INVALID_JSON");
  }
}

/** An id that is not a positive integer cannot name an employee: 404, as for an unknown one. */
function parseEmployeeId(raw: string): number {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id === 0) throw new NotFoundError();
  return id;
}

function parseReportQuery(url: string) {
  const params = new URL(url).searchParams;
  const { from, to, employeeId } = parseInput(reportQuerySchema, {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    employeeId: params.get("employeeId") ?? undefined,
  });
  return { period: { from, to }, employeeId };
}

/**
 * The HTTP side of the API, kept apart from Next.js routing so that it can be tested with
 * plain Request objects. Every outcome, failures included, is a JSON Response.
 */
export function createApiHandlers(getService: () => TrackingService) {
  async function respond(produce: (service: TrackingService) => Promise<Response>) {
    try {
      return await produce(getService());
    } catch (error) {
      return errorResponse(error);
    }
  }

  return {
    listEmployees: () => respond(async (service) => Response.json(await service.listEmployees())),

    addEmployee: (request: Request) =>
      respond(async (service) => {
        // The service validates the body at runtime; the cast only tells the compiler so.
        const input = (await readJson(request)) as { name: string };
        return Response.json(await service.addEmployee(input), { status: 201 });
      }),

    startTimer: (request: Request, rawId: string) =>
      respond(async (service) => {
        const employeeId = parseEmployeeId(rawId);
        const input = (await readJson(request)) as { description: string };
        return Response.json(await service.startTimer(employeeId, input), { status: 201 });
      }),

    stopTimer: (rawId: string) =>
      respond(async (service) => Response.json(await service.stopTimer(parseEmployeeId(rawId)))),

    getReport: (request: Request) =>
      respond(async (service) =>
        Response.json(await service.getReport(parseReportQuery(request.url))),
      ),
  };
}
