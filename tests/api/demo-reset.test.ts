import { describe, expect, it } from "vitest";
import { employees, timeEntries } from "@/server/db/schema";
import { createDemoReset } from "@/server/http/demo-reset";
import { HOUR, useTrackingService } from "../helpers/test-context";

const SECRET = "s3cret-for-tests-0123456789";

const request = (authorization?: string) =>
  new Request("http://localhost:3000/api/cron/reset-demo", {
    headers: authorization === undefined ? {} : { authorization },
  });

describe("GET /api/cron/reset-demo", () => {
  const ctx = useTrackingService();

  const resetWith = (secret: string | undefined) =>
    createDemoReset({
      getDatabase: () => ctx.db,
      secret: () => secret,
      timeZone: "Europe/Moscow",
      clock: ctx.clock,
    });

  const names = async () => (await ctx.db.select().from(employees)).map((row) => row.name);

  it("does not exist while no CRON_SECRET is set: 404, nothing changes", async () => {
    await ctx.service.addEmployee({ name: "Посторонний" });

    const response = await resetWith(undefined)(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(404);
    expect(await names()).toEqual(["Посторонний"]);
  });

  it.each([
    ["no Authorization header", undefined],
    ["a wrong secret", "Bearer wrong-secret"],
    ["the secret without Bearer", SECRET],
  ])("refuses a request with %s: 401, nothing changes", async (_, authorization) => {
    await ctx.service.addEmployee({ name: "Посторонний" });

    const response = await resetWith(SECRET)(request(authorization));

    expect(response.status).toBe(401);
    expect(await names()).toEqual(["Посторонний"]);
  });

  it("replaces all data with the past week of demo data when Vercel Cron calls: 200", async () => {
    await ctx.service.addEmployee({ name: "Посторонний" });

    const response = await resetWith(SECRET)(request(`Bearer ${SECRET}`));

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 200,
      body: { status: "seeded" },
    });
    expect(await names()).toHaveLength(4);
    expect(await names()).not.toContain("Посторонний");
    const entries = await ctx.db.select().from(timeEntries);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.endedAt!).toBeLessThan(ctx.clock());
      expect(entry.startedAt).toBeGreaterThan(ctx.clock() - 8 * 24 * HOUR);
    }
  });
});
