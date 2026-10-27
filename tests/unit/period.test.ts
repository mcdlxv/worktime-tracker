import { describe, expect, it } from "vitest";
import { dayRangeToPeriod } from "@/lib/period";
import { HOUR } from "../helpers/test-context";

/**
 * Runs the check in a given time zone. CI runs in UTC, where local and UTC midnight
 * coincide, so a `new Date("2026-10-01")` (parsed as UTC) bug would go unnoticed there.
 */
function inTimeZone(zone: string, check: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    check();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

describe("dayRangeToPeriod", () => {
  it("covers whole local days, the last one included", () => {
    inTimeZone("Asia/Tashkent", () => {
      // UTC+5 all year: local midnight is 19:00 UTC on the day before.
      expect(dayRangeToPeriod("2026-10-01", "2026-10-07")).toEqual({
        from: "2026-09-30T19:00:00.000Z",
        to: "2026-10-07T19:00:00.000Z",
      });
    });
  });

  it("gives a day with a daylight saving switch its real length of 25 hours", () => {
    inTimeZone("Europe/Berlin", () => {
      // Clocks go back from 03:00 to 02:00 on 25 October 2026; "+24 h" would lose an hour.
      const { from, to } = dayRangeToPeriod("2026-10-25", "2026-10-25");

      expect({ from, to }).toEqual({
        from: "2026-10-24T22:00:00.000Z",
        to: "2026-10-25T23:00:00.000Z",
      });
      expect(Date.parse(to) - Date.parse(from)).toBe(25 * HOUR);
    });
  });

  it("rejects a range whose end is before its start", () => {
    expect(() => dayRangeToPeriod("2026-10-07", "2026-10-01")).toThrow(
      "Начало периода должно быть не позже конца",
    );
  });

  it.each([[""], ["2026-02-30"], ["01.10.2026"]])("rejects the date %j", (value) => {
    expect(() => dayRangeToPeriod(value, "2026-10-07")).toThrow("Некорректная дата");
  });
});
