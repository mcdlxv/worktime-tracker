import { describe, expect, it } from "vitest";
import { dayRangeToPeriod, presetRange, toLocalDateString } from "@/lib/period";
import { HOUR } from "../helpers/test-context";
import { inTimeZone } from "../helpers/time-zone";

describe("presetRange", () => {
  // Wednesday, 28 October 2026, in local time.
  const wednesday = new Date(2026, 9, 28, 15, 30);

  it.each([
    ["today", "2026-10-28", "2026-10-28"],
    ["week", "2026-10-26", "2026-10-28"],
    ["month", "2026-10-01", "2026-10-28"],
  ] as const)("%s runs from %s to today", (preset, fromDate, toDate) => {
    expect(presetRange(preset, wednesday)).toEqual({ fromDate, toDate });
  });

  it("starts the week on Monday, also on a Sunday that opens a month", () => {
    expect(presetRange("week", new Date(2026, 10, 1, 12))).toEqual({
      fromDate: "2026-10-26",
      toDate: "2026-11-01",
    });
  });
});

describe("toLocalDateString", () => {
  it("gives the local calendar date, not the UTC one", () => {
    inTimeZone("Asia/Tashkent", () => {
      // 02:00 on 1 November in UTC+5 is still 31 October in UTC.
      expect(toLocalDateString(new Date(2026, 10, 1, 2, 0))).toBe("2026-11-01");
    });
  });
});

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
