import { describe, expect, it } from "vitest";
import { addDays, calendarDate, wallClockTime } from "@/server/db/wall-clock";

describe("wall-clock time in a named time zone", () => {
  it("finds the instant when Moscow clocks show 09:00", () => {
    // Moscow is UTC+3 all year round.
    expect(
      wallClockTime({ year: 2026, month: 10, day: 27, hour: 9, minute: 0 }, "Europe/Moscow"),
    ).toBe(Date.UTC(2026, 9, 27, 6, 0));
  });

  it("keeps 09:00 on both sides of a daylight saving switch", () => {
    // Berlin leaves summer time on 25 October 2026: UTC+2 before it, UTC+1 after.
    expect(
      wallClockTime({ year: 2026, month: 10, day: 23, hour: 9, minute: 0 }, "Europe/Berlin"),
    ).toBe(Date.UTC(2026, 9, 23, 7, 0));
    expect(
      wallClockTime({ year: 2026, month: 10, day: 26, hour: 9, minute: 0 }, "Europe/Berlin"),
    ).toBe(Date.UTC(2026, 9, 26, 8, 0));
  });

  it("rolls minutes past 59 over into the next hour, as Date does", () => {
    expect(
      wallClockTime({ year: 2026, month: 10, day: 27, hour: 14, minute: 75 }, "Europe/Moscow"),
    ).toBe(Date.UTC(2026, 9, 27, 12, 15));
  });

  it("gives the date on the calendar in the zone, which can differ from the UTC date", () => {
    // 22:30 UTC on Tuesday is already 01:30 on Wednesday in Moscow.
    expect(calendarDate(Date.UTC(2026, 9, 27, 22, 30), "Europe/Moscow")).toEqual({
      year: 2026,
      month: 10,
      day: 28,
      weekday: 3,
    });
  });

  it("steps across the end of a month by the calendar", () => {
    expect(addDays({ year: 2026, month: 11, day: 2 }, -3)).toEqual({
      year: 2026,
      month: 10,
      day: 30,
      weekday: 5,
    });
  });
});
