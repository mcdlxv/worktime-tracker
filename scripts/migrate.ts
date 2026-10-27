import { loadEnvConfig } from "@next/env";
import { migrateDatabase, openDatabase } from "../src/server/db/client";
import { databaseConfig } from "../src/server/db/config";

// Same .env files and precedence as Next.js itself.
loadEnvConfig(process.cwd());

async function main() {
  const { url, authToken } = databaseConfig();
  const { client, db } = openDatabase(url, authToken);
  try {
    await migrateDatabase(db);
    console.log(`Database is up to date: ${url}`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
