import { loadEnvConfig } from "@next/env";
import { migrateDatabase, openDatabase } from "../src/server/db/client";
import { databaseConfig } from "../src/server/db/config";
import { seedDemoData } from "../src/server/db/seed";

// Same .env files and precedence as Next.js itself.
loadEnvConfig(process.cwd());

async function main() {
  const reset = process.argv.includes("--reset");
  const { url, authToken } = databaseConfig();
  const { client, db } = openDatabase(url, authToken);
  try {
    await migrateDatabase(db);
    const outcome = await seedDemoData(db, { reset });
    console.log(
      outcome === "seeded"
        ? `Demo data added to ${url}`
        : `${url} already has data; run "npm run db:seed -- --reset" to replace it`,
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
