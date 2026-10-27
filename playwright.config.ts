import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run against a production build on a port and database of their own, so
 * a running `npm run dev` neither interferes nor matters. They drive the installed Google
 * Chrome (channel "chrome"): nothing to download, and GitHub's Ubuntu runners have it too.
 */
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    // CI has already run `npm run build` by the time it gets here.
    command: process.env.CI
      ? `npm run start -- --port ${PORT}`
      : `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { DATABASE_URL: "file:./data/e2e.db" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
