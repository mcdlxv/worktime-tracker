import { describe, expect, it } from "vitest";
import { buildReport, isInPeriod, overlapMs } from "@/server/tracking/report";
import type { Employee, Period, TimeEntry } from "@/server/tracking/types";
import { HOUR, MINUTE } from "../helpers/test-context";

/** A moment on 1 October 2026, UTC. */
const at = (hours: number, minutes = 0) => Date.UTC(2026, 9, 1, hours, minutes);

/** The period [10:00, 18:00). */
const PERIOD: Period = { from: at(10), to: at(18) };

let nextId = 1;
const entry = (startedAt: number, endedAt: number | null, employeeId = 1): TimeEntry => ({
  id: nextId++,
  employeeId,
  description: "Задача",
  startedAt,
  endedAt,
});

const employee = (id: number, name: string): Employee => ({ id, name, createdAt: at(8) });

describe("which part of an entry falls into the period [10:00, 18:00)", () => {
  it.each([
    ["inside the period", at(11), at(12, 30), true, 1.5 * HOUR],
    ["starting before it: clipped at the start", at(8), at(11), true, 1 * HOUR],
    ["ending after it: clipped at the end", at(17), at(20), true, 1 * HOUR],
    ["spanning the whole period", at(9), at(19), true, 8 * HOUR],
    ["ending exactly when the period starts", at(8), at(10), false, 0],
    ["starting exactly when the period ends", at(18), at(19), false, 0],
    ["of zero length inside the period", at(12), at(12), true, 0],
  ])("an entry %s", (_, startedAt, endedAt, included, duration) => {
    const finished = entry(startedAt, endedAt);
    const now = at(23);

    expect(isInPeriod(finished, PERIOD, now)).toBe(included);
    expect(overlapMs(finished, PERIOD, now)).toBe(duration);
  });

  it("counts a running entry up to now", () => {
    const running = entry(at(16), null);
    const now = at(17, 15);

    expect(isInPeriod(running, PERIOD, now)).toBe(true);
    expect(overlapMs(running, PERIOD, now)).toBe(1 * HOUR + 15 * MINUTE);
  });

  it("clips a running entry at the end of the period when now is later", () => {
    const running = entry(at(16), null);

    expect(overlapMs(running, PERIOD, at(21))).toBe(2 * HOUR);
  });

  it("leaves out an entry still running from before the period when now is before it", () => {
    const running = entry(at(8), null);

    expect(isInPeriod(running, PERIOD, at(9))).toBe(false);
  });
});

describe("buildReport", () => {
  const now = at(17, 30);

  it("is empty but well-formed when there are no employees", () => {
    expect(buildReport({ employees: [], entries: [], period: PERIOD, now })).toEqual({
      period: PERIOD,
      generatedAt: now,
      employees: [],
      totalMs: 0,
    });
  });

  it("gives every employee a zero total and no entries when nothing was tracked", () => {
    const report = buildReport({
      employees: [employee(1, "Алия Тестова"), employee(2, "Борис Примеров")],
      entries: [],
      period: PERIOD,
      now,
    });

    expect(report.employees).toEqual([
      { employee: employee(1, "Алия Тестова"), entries: [], totalMs: 0 },
      { employee: employee(2, "Борис Примеров"), entries: [], totalMs: 0 },
    ]);
    expect(report.totalMs).toBe(0);
  });

  it("groups entries by employee in time order and adds up the totals", () => {
    const late = entry(at(13), at(14), 1);
    const early = entry(at(10, 30), at(11), 1);
    const outside = entry(at(6), at(7), 1);
    const running = entry(at(17), null, 2);

    const report = buildReport({
      employees: [employee(1, "Алия Тестова"), employee(2, "Борис Примеров")],
      entries: [late, running, outside, early],
      period: PERIOD,
      now,
    });

    const [alia, boris] = report.employees;
    expect(alia.entries.map((e) => e.id)).toEqual([early.id, late.id]);
    expect(alia.entries.map((e) => e.durationMs)).toEqual([30 * MINUTE, 1 * HOUR]);
    expect(alia.totalMs).toBe(1.5 * HOUR);
    expect(boris.entries).toEqual([{ ...running, durationMs: 30 * MINUTE, isRunning: true }]);
    expect(boris.totalMs).toBe(30 * MINUTE);
    expect(report.totalMs).toBe(2 * HOUR);
  });
});
