import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, databaseConfig } from "@/server/db/config";

const TURSO = { TURSO_DATABASE_URL: "libsql://demo.turso.io", TURSO_AUTH_TOKEN: "turso-token" };

describe("databaseConfig", () => {
  it("uses the local SQLite file when nothing is set", () => {
    expect(databaseConfig({})).toEqual({ url: DEFAULT_DATABASE_URL, authToken: undefined });
  });

  it("treats blank values, as in a copied .env.example, as not set", () => {
    expect(databaseConfig({ DATABASE_URL: "", DATABASE_AUTH_TOKEN: "" })).toEqual({
      url: DEFAULT_DATABASE_URL,
      authToken: undefined,
    });
  });

  it("takes the variables that the Turso Cloud integration adds on Vercel", () => {
    expect(databaseConfig(TURSO)).toEqual({
      url: "libsql://demo.turso.io",
      authToken: "turso-token",
    });
  });

  it("prefers DATABASE_URL, with its own token, over the integration's pair", () => {
    expect(databaseConfig({ ...TURSO, DATABASE_URL: "file:./other.db" })).toEqual({
      url: "file:./other.db",
      authToken: undefined,
    });
  });

  it("stops on Vercel when no database is configured, as a function keeps no files", () => {
    expect(() => databaseConfig({ VERCEL: "1" })).toThrow(/Turso Cloud integration/);
  });

  it("uses the integration's database on Vercel", () => {
    expect(databaseConfig({ ...TURSO, VERCEL: "1" })).toEqual({
      url: "libsql://demo.turso.io",
      authToken: "turso-token",
    });
  });
});
