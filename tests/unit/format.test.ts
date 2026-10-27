import { describe, expect, it } from "vitest";
import { formatClock, formatDate, formatDuration, formatTime } from "@/lib/format";
import { inTimeZone } from "../helpers/time-zone";

describe("formatDate and formatTime", () => {
  it("show a moment in the browser's time zone", () => {
    // Europe/Berlin rather than this machine's UTC+5, so a formatter that froze the
    // zone it was created in would fail here.
    inTimeZone("Europe/Berlin", () => {
      const moment = Date.UTC(2026, 9, 27, 23, 5); // 00:05 on 28 October in Berlin (UTC+1)

      expect(formatDate(moment)).toBe("28 октября");
      expect(formatTime(moment)).toBe("00:05");
    });
  });
});

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
