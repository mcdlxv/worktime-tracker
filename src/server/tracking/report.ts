import type { Employee, EmployeeReport, Period, Report, ReportEntry, TimeEntry } from "./types";

/** When the entry ended, or "now" while its timer is still running. */
const endOf = (entry: TimeEntry, now: number) => entry.endedAt ?? now;

/**
 * Does the entry overlap the period [from, to)? Two intervals overlap when each starts
 * before the other ends. An entry that stopped exactly at `from` belongs to the previous
 * period; one that starts exactly at `to` belongs to the next.
 */
export function isInPeriod(entry: TimeEntry, period: Period, now: number): boolean {
  return entry.startedAt < period.to && endOf(entry, now) > period.from;
}

/** How much of the entry lies inside the period, in milliseconds. */
export function overlapMs(entry: TimeEntry, period: Period, now: number): number {
  const start = Math.max(entry.startedAt, period.from);
  const end = Math.min(endOf(entry, now), period.to);
  return Math.max(0, end - start);
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Totals per employee for the period, keeping the employees in the given order.
 * Employees without entries get an empty list and a total of 0, never null or NaN.
 */
export function buildReport({
  employees,
  entries,
  period,
  now,
}: {
  employees: Employee[];
  entries: TimeEntry[];
  period: Period;
  now: number;
}): Report {
  const entriesByEmployee = new Map<number, ReportEntry[]>();
  for (const entry of entries) {
    if (!isInPeriod(entry, period, now)) continue;
    const reportEntry = {
      ...entry,
      durationMs: overlapMs(entry, period, now),
      isRunning: entry.endedAt === null,
    };
    entriesByEmployee.set(entry.employeeId, [
      ...(entriesByEmployee.get(entry.employeeId) ?? []),
      reportEntry,
    ]);
  }

  const employeeReports: EmployeeReport[] = employees.map((employee) => {
    const own = (entriesByEmployee.get(employee.id) ?? []).sort(
      (a, b) => a.startedAt - b.startedAt,
    );
    return { employee, entries: own, totalMs: sum(own.map((e) => e.durationMs)) };
  });

  return {
    period,
    generatedAt: now,
    employees: employeeReports,
    totalMs: sum(employeeReports.map((report) => report.totalMs)),
  };
}
