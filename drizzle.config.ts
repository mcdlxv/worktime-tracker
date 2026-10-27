import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { databaseConfig } from "./src/server/db/config";

// Same .env files and precedence as Next.js itself.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "turso",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: databaseConfig(),
});
