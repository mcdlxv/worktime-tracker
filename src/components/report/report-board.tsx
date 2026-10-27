"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { useIsClient } from "@/components/use-is-client";
import { apiClient, describeError } from "@/lib/api-client";
import { dayRangeToPeriod, presetRange } from "@/lib/period";
import type { Employee, Report } from "@/server/tracking/types";
import { type DateRange, PeriodPicker } from "./period-picker";
import { ReportTable } from "./report-table";

type Query =
  | { valid: true; key: string; from: string; to: string; employeeId: number | undefined }
  | { valid: false; message: string };

function buildQuery(range: DateRange, employeeId: number | undefined): Query {
  try {
    const { from, to } = dayRangeToPeriod(range.fromDate, range.toDate);
    return { valid: true, key: `${from}|${to}|${employeeId ?? ""}`, from, to, employeeId };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** The report screen; it starts from "this week", so it needs the browser's own date. */
export function ReportBoard() {
  const isClient = useIsClient();
  return (
    <section aria-labelledby="report-title" className="space-y-8">
      <div className="space-y-2">
        <h1 id="report-title" className="text-3xl font-semibold tracking-tight">
          Отчёт
        </h1>
        <p className="text-muted">
          Сколько времени каждый сотрудник отработал за выбранный период.
        </p>
      </div>
      {isClient ? <ReportScreen /> : <p className="text-sm text-muted">Загрузка…</p>}
    </section>
  );
}

function ReportScreen() {
  const [range, setRange] = useState<DateRange>(() => presetRange("week"));
  const [employeeId, setEmployeeId] = useState<number | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string }>();
  // Bumped by "Повторить": a new key, so the old error gives way to "Считаю…" at once.
  const [attempt, setAttempt] = useState(0);

  const query = useMemo(() => buildQuery(range, employeeId), [range, employeeId]);
  const requestKey = query.valid ? `${query.key}#${attempt}` : null;

  useEffect(() => {
    apiClient.listEmployees().then(setEmployees, () => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!query.valid || requestKey === null) return;
    // Switching presets quickly can let an older, slower answer arrive last; it is ignored.
    let isLatest = true;
    apiClient.getReport(query).then(
      (report) => isLatest && setResult({ key: requestKey, report }),
      (error) => isLatest && setResult({ key: requestKey, error: describeError(error) }),
    );
    return () => {
      isLatest = false;
    };
  }, [query, requestKey]);

  const current = result?.key === requestKey ? result : undefined;

  return (
    <div className="space-y-8">
      <PeriodPicker
        range={range}
        onRangeChange={setRange}
        employees={employees}
        employeeId={employeeId}
        onEmployeeChange={setEmployeeId}
      />
      {!query.valid ? (
        <p role="alert" className="text-sm text-alert">
          {query.message}
        </p>
      ) : !current ? (
        <p className="text-sm text-muted">Считаю…</p>
      ) : current.error ? (
        <div className="flex flex-wrap items-center gap-4">
          <p role="alert" className="text-sm text-alert">
            {current.error}
          </p>
          <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
            Повторить
          </Button>
        </div>
      ) : (
        current.report && <ReportTable report={current.report} />
      )}
    </div>
  );
}
