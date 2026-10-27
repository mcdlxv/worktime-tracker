import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_TIME_ZONE } from "@/server/db/seed";

const readVercelConfig = () => JSON.parse(readFileSync("vercel.json", "utf8"));

describe("Vercel configuration", () => {
  it("migrates the database and adds demo data to an empty one before every build", () => {
    // The steps run on Vercel, where the Turso integration's variables are set, so the
    // database token never has to leave Vercel.
    const steps = readVercelConfig()
      .buildCommand.split("&&")
      .map((step: string) => step.trim());

    expect(steps).toEqual([
      "npm run db:migrate",
      // Vercel builds in UTC; the demo workday should read 09:00–17:40 in Moscow time.
      "TZ=Europe/Moscow npm run db:seed",
      "npm run build",
    ]);
  });

  it("runs the functions next to the database: Dublin, as Turso's aws-eu-west-1", () => {
    expect(readVercelConfig().regions).toEqual(["dub1"]);
  });

  it("resets the demo data once a day, at night in Moscow", () => {
    // 00:00 UTC is 03:00 in Moscow; on the Hobby plan Vercel runs it within that hour.
    expect(readVercelConfig().crons).toEqual([
      { path: "/api/cron/reset-demo", schedule: "0 0 * * *" },
    ]);
  });

  it("seeds during the build in the same time zone as the daily reset", () => {
    expect(readVercelConfig().buildCommand).toContain(`TZ=${DEMO_TIME_ZONE} npm run db:seed`);
  });
});
