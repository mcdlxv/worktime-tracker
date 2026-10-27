export const DEFAULT_DATABASE_URL = "file:./data/worktime.db";

/**
 * Where the database lives, first match wins:
 * - DATABASE_URL with DATABASE_AUTH_TOKEN, set by hand;
 * - TURSO_DATABASE_URL with TURSO_AUTH_TOKEN, which the Turso Cloud integration adds to a
 *   Vercel project;
 * - a local SQLite file.
 * A URL is taken together with its own token. Empty values count as unset, so a copied
 * .env.example with blank fields still works.
 */
export function databaseConfig(env: Record<string, string | undefined> = process.env) {
  if (env.DATABASE_URL) {
    return { url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN || undefined };
  }
  if (env.TURSO_DATABASE_URL) {
    return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN || undefined };
  }
  // A Vercel function keeps nothing it writes to its own files, so a local database there
  // would lose every entry. Vercel sets VERCEL=1 both during the build and at runtime: the
  // build stops here, with this message, before a deployment that cannot store anything.
  if (env.VERCEL === "1") {
    throw new Error(
      "No database is configured for this Vercel deployment: connect the Turso Cloud integration to the project, or set DATABASE_URL.",
    );
  }
  return { url: DEFAULT_DATABASE_URL, authToken: undefined };
}
