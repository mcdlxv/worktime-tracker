export const DEFAULT_DATABASE_URL = "file:./data/worktime.db";

/**
 * Where the database lives: a local SQLite file by default, or Turso when
 * DATABASE_URL points to a libsql:// address. Empty values fall back to the defaults,
 * so a copied .env.example with blank fields still works.
 */
export function databaseConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    url: env.DATABASE_URL || DEFAULT_DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN || undefined,
  };
}
