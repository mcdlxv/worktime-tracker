import { describe, expect, it } from "vitest";
import { formatClock, formatDuration } from "@/lib/format";

describe("formatDuration", () => {
  it.each([
    [0, "0 мин"],
    [59_999, "0 мин"],
    [60_000, "1 мин"],
    [3_725_000, "1 ч 02 мин"],
    [7_200_000, "2 ч 00 мин"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "00:00:00"],
    [3_725_000, "01:02:05"],
    [90_000_000, "25:00:00"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });

  it("shows zero instead of a negative time when the browser clock lags behind the server", () => {
    expect(formatClock(-1_500)).toBe("00:00:00");
  });
});
