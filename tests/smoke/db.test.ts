import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "@/server/db/client";
import { useTempDir } from "../helpers/temp-dir";

describe("openDatabase", () => {
  const tmp = useTempDir();

  it("creates missing parent directories for a file database", () => {
    const file = join(tmp.path, "nested", "dir", "app.db");
    const { client } = openDatabase(`file:${file}`);
    try {
      expect(existsSync(file)).toBe(true);
    } finally {
      client.close();
    }
  });

  it("runs queries through the native libSQL driver", async () => {
    const { client } = openDatabase(`file:${join(tmp.path, "app.db")}`);
    try {
      const result = await client.execute("SELECT 1 AS ok");
      expect(result.rows[0].ok).toBe(1);
    } finally {
      client.close();
    }
  });

  it("rejects rows that reference a missing parent row", async () => {
    // Stock SQLite ignores foreign keys unless asked per connection; libSQL enforces them
    // by default. This guards the behaviour in case the driver is ever swapped.
    const { client } = openDatabase(`file:${join(tmp.path, "app.db")}`);
    try {
      await client.execute("CREATE TABLE parent (id INTEGER PRIMARY KEY)");
      await client.execute(
        "CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id))",
      );
      await expect(client.execute("INSERT INTO child (parent_id) VALUES (42)")).rejects.toThrow(
        /FOREIGN KEY constraint failed/,
      );
    } finally {
      client.close();
    }
  });
});
