import { type Database, openDatabase } from "@/server/db/client";
import { databaseConfig } from "@/server/db/config";
import { DEMO_TIME_ZONE } from "@/server/db/seed";
import { createTrackingService } from "@/server/tracking/service";
import type { TrackingService } from "@/server/tracking/types";
import { createDemoReset } from "./demo-reset";
import { createApiHandlers } from "./handlers";

// The database client is opened once per process and kept on globalThis: hot reloading in
// development re-runs this module and would otherwise open a new client on every edit.
// The service is cheap and is rebuilt from the current code after a reload. Keeping it on
// globalThis as well served stale methods once the service changed (AI log, defect 8).
const globalWithDatabase = globalThis as typeof globalThis & { trackingDatabase?: Database };

let service: TrackingService | undefined;

export function getDatabase(): Database {
  if (!globalWithDatabase.trackingDatabase) {
    const { url, authToken } = databaseConfig();
    globalWithDatabase.trackingDatabase = openDatabase(url, authToken).db;
  }
  return globalWithDatabase.trackingDatabase;
}

export function getTrackingService(): TrackingService {
  service ??= createTrackingService({ db: getDatabase() });
  return service;
}

/** What the route files call. */
export const api = createApiHandlers(getTrackingService);

export const demoReset = createDemoReset({
  getDatabase,
  secret: () => process.env.CRON_SECRET,
  timeZone: DEMO_TIME_ZONE,
});
