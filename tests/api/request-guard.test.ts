import { describe, expect, it } from "vitest";
import { createApiHandlers } from "@/server/http/handlers";
import { useTrackingService } from "../helpers/test-context";

const BASE = "http://localhost:3000";
const JSON_TYPE = { "content-type": "application/json" };

/** A POST with exactly the given headers, as a browser or another client would send it. */
const post = (path: string, headers: Record<string, string>, body?: unknown) =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const read = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe("protection of state-changing requests", () => {
  const ctx = useTrackingService();
  const api = () => createApiHandlers(() => ctx.service);

  it.each(["cross-site", "same-site"])(
    "refuses a request that a browser marks as %s: 403",
    async (site) => {
      const response = await api().addEmployee(
        post("/api/employees", { ...JSON_TYPE, "sec-fetch-site": site }, { name: "Чужой" }),
      );

      expect(await read(response)).toEqual({
        status: 403,
        body: { error: { code: "CROSS_SITE_REQUEST", message: "Запрос с другого сайта отклонён" } },
      });
      expect(await ctx.service.listEmployees()).toEqual([]);
    },
  );

  it.each([
    ["from the app's own page", { "sec-fetch-site": "same-origin" }],
    ["from a client that is not a browser, such as curl", {}],
  ])("accepts a request %s", async (_, headers) => {
    const response = await api().addEmployee(
      post("/api/employees", { ...JSON_TYPE, ...headers }, { name: "Алия Тестова" }),
    );

    expect(response.status).toBe(201);
  });

  it("refuses a body not declared as JSON, as in a cross-site text/plain post: 415", async () => {
    const response = await api().addEmployee(
      post("/api/employees", { "content-type": "text/plain" }, { name: "Чужой" }),
    );

    expect(await read(response)).toEqual({
      status: 415,
      body: {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Нужен заголовок Content-Type: application/json",
        },
      },
    });
    expect(await ctx.service.listEmployees()).toEqual([]);
  });

  it("accepts a JSON content type with parameters", async () => {
    const response = await api().addEmployee(
      post(
        "/api/employees",
        { "content-type": "application/json; charset=utf-8" },
        { name: "Алия Тестова" },
      ),
    );

    expect(response.status).toBe(201);
  });

  it("guards starting and stopping the timer in the same way", async () => {
    const { id } = await ctx.service.addEmployee({ name: "Алия Тестова" });
    const crossSite = { ...JSON_TYPE, "sec-fetch-site": "cross-site" };
    const start = (headers: Record<string, string>) =>
      api().startTimer(
        post(`/api/employees/${id}/timer/start`, headers, { description: "Чужая задача" }),
        String(id),
      );
    expect((await start(crossSite)).status).toBe(403);
    const entry = await ctx.service.startTimer(id, { description: "Сверка накладных" });
    const stop = (headers: Record<string, string>) =>
      api().stopEntry(post(`/api/time-entries/${entry.id}/stop`, headers), String(entry.id));

    expect((await stop(crossSite)).status).toBe(403);
    expect((await stop({})).status).toBe(415);

    const [employee] = await ctx.service.listEmployees();
    expect(employee.runningEntry?.description).toBe("Сверка накладных");
  });
});
