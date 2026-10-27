import { describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db/client";
import { timeEntries } from "@/server/db/schema";
import { createTrackingService } from "@/server/tracking/service";
import { HOUR, MINUTE, createFakeClock, useTrackingService } from "../helpers/test-context";

describe("data after a restart", () => {
  const ctx = useTrackingService();

  it("keeps employees, finished entries and a running timer", async () => {
    const employee = await ctx.service.addEmployee({ name: "Алия Тестова" });
    await ctx.service.startTimer(employee.id, { description: "Сверка накладных" });
    ctx.clock.advance(30 * MINUTE);
    await ctx.service.stopTimer(employee.id);
    ctx.clock.advance(5 * MINUTE);
    const running = await ctx.service.startTimer(employee.id, { description: "Звонок клиенту" });

    // A restart in miniature: the first client lets go of the file, then a new client and
    // a new service open it again. A real process restart is also checked by hand (task 4.6).
    ctx.client.close();
    const restarted = openDatabase(ctx.dbUrl);
    try {
      const service = createTrackingService({
        db: restarted.db,
        clock: createFakeClock(running.startedAt + 2 * HOUR),
      });

      const [listed] = await service.listEmployees();
      expect(listed).toMatchObject({
        id: employee.id,
        name: "Алия Тестова",
        runningEntry: running,
      });
      expect(await restarted.db.select().from(timeEntries)).toHaveLength(2);

      const stopped = await service.stopTimer(employee.id);
      expect(stopped.endedAt).toBe(running.startedAt + 2 * HOUR);
    } finally {
      restarted.client.close();
    }
  });
});
