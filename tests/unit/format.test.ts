import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatDate,
  formatDuration,
  formatEntryTimes,
  formatTime,
} from "@/lib/format";
import { inTimeZone } from "../helpers/time-zone";

describe("formatEntryTimes", () => {
  // Berlin is UTC+1 in late October 2026; local times below are Berlin times.
  const berlin = (day: number, hours: number, minutes = 0) =>
    Date.UTC(2026, 9, day, hours - 1, minutes);

  it.each([
    ["within one day", berlin(26, 9), berlin(26, 11, 30), "09:00–11:30"],
    ["still running", berlin(26, 9), null, "09:00–…"],
    ["past midnight, with the end date", berlin(26, 22), berlin(27, 2), "22:00 – 27 октября 02:00"],
  ])("shows an entry %s", (_, startedAt, endedAt, text) => {
    inTimeZone("Europe/Berlin", () => {
      expect(formatEntryTimes(startedAt, endedAt)).toBe(text);
    });
  });
});

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
  // Under a minute but not zero reads "< 1 мин": two short entries with a total of 1 minute
  // would otherwise read as "0 мин" + "0 мин" = "1 мин".
  it.each([
    [0, "0 мин"],
    [1, "< 1 мин"],
    [59_999, "< 1 мин"],
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
