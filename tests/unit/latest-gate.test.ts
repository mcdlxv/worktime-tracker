import { describe, expect, it } from "vitest";
import { createLatestGate } from "@/lib/latest-gate";

describe("createLatestGate", () => {
  it("keeps a lone request current", () => {
    const gate = createLatestGate();

    const isNewest = gate.begin();

    expect(isNewest()).toBe(true);
  });

  it("makes an older request stale as soon as a newer one starts, whichever answers first", () => {
    const gate = createLatestGate();
    const focusReload = gate.begin();
    const reloadAfterStop = gate.begin();

    // The newer answer arrives first, the older one last: only the newer may show.
    expect(reloadAfterStop()).toBe(true);
    expect(focusReload()).toBe(false);
  });
});
