import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    tempRoot: string;
  }
}

/**
 * One temporary root per test run, removed when the run is over.
 *
 * Tests cannot delete their database files right after `client.close()`: on Windows
 * libSQL keeps the file open until its native statement objects are garbage-collected,
 * so the delete fails with EBUSY at an unpredictable moment. Once the test workers have
 * exited, every handle is gone and the whole root can be removed in one go.
 */
export default function setup(project: TestProject) {
  const root = mkdtempSync(join(tmpdir(), "worktime-tests-"));
  project.provide("tempRoot", root);

  return () => {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      console.warn(`Could not remove the test temp root ${root}:`, error);
    }
  };
}
