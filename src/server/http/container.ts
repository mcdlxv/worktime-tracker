import { openDatabase } from "@/server/db/client";
import { databaseConfig } from "@/server/db/config";
import { createTrackingService } from "@/server/tracking/service";
import type { TrackingService } from "@/server/tracking/types";
import { createApiHandlers } from "./handlers";

// One service, and so one database client, per server process. It lives on globalThis
// because hot reloading in development re-runs this module and would otherwise open a
// new database client on every edit.
const globalWithService = globalThis as typeof globalThis & { trackingService?: TrackingService };

export function getTrackingService(): TrackingService {
  if (!globalWithService.trackingService) {
    const { url, authToken } = databaseConfig();
    globalWithService.trackingService = createTrackingService({
      db: openDatabase(url, authToken).db,
    });
  }
  return globalWithService.trackingService;
}

/** What the route files call. */
export const api = createApiHandlers(getTrackingService);
