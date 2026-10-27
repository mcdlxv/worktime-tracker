import { type Database, openDatabase } from "@/server/db/client";
import { databaseConfig } from "@/server/db/config";
import { createTrackingService } from "@/server/tracking/service";
import type { TrackingService } from "@/server/tracking/types";
import { createApiHandlers } from "./handlers";

// The database client is opened once per process and kept on globalThis: hot reloading in
// development re-runs this module and would otherwise open a new client on every edit.
// The service is cheap and is rebuilt from the current code after a reload. Keeping it on
// globalThis as well served stale methods once the service changed (AI log, defect 7).
const globalWithDatabase = globalThis as typeof globalThis & { trackingDatabase?: Database };

let service: TrackingService | undefined;

export function getTrackingService(): TrackingService {
  if (!globalWithDatabase.trackingDatabase) {
    const { url, authToken } = databaseConfig();
    globalWithDatabase.trackingDatabase = openDatabase(url, authToken).db;
  }
  service ??= createTrackingService({ db: globalWithDatabase.trackingDatabase });
  return service;
}

/** What the route files call. */
export const api = createApiHandlers(getTrackingService);
