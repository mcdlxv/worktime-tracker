import { z } from "zod";
import { NotFoundError, ValidationError } from "@/server/tracking/errors";
import type { TrackingService } from "@/server/tracking/types";
import { parseInput } from "@/server/tracking/validation";
import { HttpError } from "./errors";
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

/**
 * Requests that change data are accepted only as JSON from the app's own pages. There is no
 * login (the assignment rules it out), so this is not about sessions: it keeps a page on
 * another site from making a visitor's browser write to an app on localhost or an intranet.
 * - A browser marks such a request with Sec-Fetch-Site: cross-site (or same-site, for a
 *   neighbouring subdomain): 403. Clients that are not browsers, such as curl, send no
 *   Sec-Fetch-Site and pass.
 * - The body must be declared as JSON: 415. Another site cannot send that content type
 *   without a CORS preflight, which this API never grants, whereas a text/plain post needs
 *   none, and request.json() would parse its body all the same.
 */
function assertSameSiteJson(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    throw new HttpError(403, "CROSS_SITE_REQUEST", "Запрос с другого сайта отклонён");
  }
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Нужен заголовок Content-Type: application/json",
    );
  }
}

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
        assertSameSiteJson(request);
        // The service validates the body at runtime; the cast only tells the compiler so.
        const input = (await readJson(request)) as { name: string };
        return Response.json(await service.addEmployee(input), { status: 201 });
      }),

    startTimer: (request: Request, rawId: string) =>
      respond(async (service) => {
        assertSameSiteJson(request);
        const employeeId = parseEmployeeId(rawId);
        const input = (await readJson(request)) as { description: string };
        return Response.json(await service.startTimer(employeeId, input), { status: 201 });
      }),

    stopTimer: (request: Request, rawId: string) =>
      respond(async (service) => {
        assertSameSiteJson(request);
        return Response.json(await service.stopTimer(parseEmployeeId(rawId)));
      }),

    getReport: (request: Request) =>
      respond(async (service) =>
        Response.json(await service.getReport(parseReportQuery(request.url))),
      ),
  };
}
