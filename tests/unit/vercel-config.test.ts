import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
