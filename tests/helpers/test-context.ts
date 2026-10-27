import { join } from "node:path";
import type { Client } from "@libsql/client";
import { afterEach, beforeEach } from "vitest";
import { migrateDatabase, openDatabase, type Database } from "@/server/db/client";
import { createTrackingService } from "@/server/tracking/service";
import type { TrackingService } from "@/server/tracking/types";
import { useTempDir } from "./temp-dir";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
/** 1 October 2026, 09:00 UTC — where every fake clock starts. */
export const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);

export interface FakeClock {
  (): number;
  set(ms: number): void;
  advance(ms: number): void;
}

export function createFakeClock(start = T0): FakeClock {
  let now = start;
  return Object.assign(() => now, {
    set: (ms: number) => {
      now = ms;
    },
    advance: (ms: number) => {
      now += ms;
    },
  });
}

export interface TrackingTestContext {
  service: TrackingService;
  db: Database;
  client: Client;
  clock: FakeClock;
  dbUrl: string;
}

/** A freshly migrated database file and a tracking service on a fake clock, per test. */
export function useTrackingService(): TrackingTestContext {
  const tmp = useTempDir();
  const ctx = {} as TrackingTestContext;

  beforeEach(async () => {
    ctx.dbUrl = `file:${join(tmp.path, "app.db")}`;
    const { client, db } = openDatabase(ctx.dbUrl);
    await migrateDatabase(db);
    ctx.client = client;
    ctx.db = db;
    ctx.clock = createFakeClock();
    ctx.service = createTrackingService({ db, clock: ctx.clock });
  });

  afterEach(() => {
    ctx.client.close();
  });

  return ctx;
}
