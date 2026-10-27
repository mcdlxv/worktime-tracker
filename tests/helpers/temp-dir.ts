import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, inject } from "vitest";

/**
 * Gives every test its own empty directory inside the run's temporary root.
 * Nothing is deleted per test: see tests/global-setup.ts for why and when cleanup happens.
 */
export function useTempDir(): { readonly path: string } {
  const state = { path: "" };

  beforeEach(() => {
    state.path = mkdtempSync(join(inject("tempRoot"), "test-"));
  });

  return state;
}
