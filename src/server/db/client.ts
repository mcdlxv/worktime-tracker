import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { DEFAULT_DATABASE_URL } from "./config";
import * as schema from "./schema";

/**
 * Opens a libSQL database: a local SQLite file (`file:` URL) or a remote Turso
 * database (`libsql://` URL plus an auth token). The same code serves both.
 * libSQL enforces foreign keys by default, unlike stock SQLite, so no PRAGMA is needed.
 */
export function openDatabase(url: string = DEFAULT_DATABASE_URL, authToken?: string) {
  if (url.startsWith("file:")) {
    // SQLite creates the database file, but not the directory it lives in.
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({ url, authToken });
  return { client, db: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof openDatabase>["db"];

/** Applies the SQL migrations from ./drizzle that the database has not seen yet. */
export async function migrateDatabase(db: Database) {
  await migrate(db, { migrationsFolder: "drizzle" });
}
