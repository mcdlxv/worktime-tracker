import { timingSafeEqual } from "node:crypto";
import type { Database } from "@/server/db/client";
import { seedDemoData } from "@/server/db/seed";
import type { Clock } from "@/server/tracking/types";
import { errorResponse } from "./respond";

const failure = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

/** Compared in constant time, so the response time gives no hint of how much of a guess matched. */
function isSameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The daily reset of the public demo, which Vercel Cron calls (vercel.json): all data is
 * replaced with the past week of demo data, so the report never shows an empty week.
 * Vercel sends the project's CRON_SECRET as "Authorization: Bearer <secret>". While no
 * CRON_SECRET is set the endpoint does not exist (404): nobody can reset a deployment
 * that never asked for it.
 */
export function createDemoReset({
  getDatabase,
  secret,
  timeZone,
  clock = Date.now,
}: {
  getDatabase: () => Database;
  secret: () => string | undefined;
  timeZone: string;
  clock?: Clock;
}) {
  return async (request: Request): Promise<Response> => {
    const expected = secret();
    if (!expected) return failure(404, "NOT_FOUND", "Не найдено");
    if (!isSameSecret(request.headers.get("authorization") ?? "", `Bearer ${expected}`)) {
      return failure(401, "UNAUTHORIZED", "Нужен секрет Vercel Cron");
    }
    try {
      const status = await seedDemoData(getDatabase(), { reset: true, now: clock(), timeZone });
      return Response.json({ status });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
