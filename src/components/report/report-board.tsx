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
  // Bumped to ask the same query again: on window focus, and by "Повторить".
  const [refreshes, setRefreshes] = useState(0);

  const query = useMemo(() => buildQuery(range, employeeId), [range, employeeId]);

  useEffect(() => {
    apiClient.listEmployees().then(setEmployees, () => setEmployees([]));
  }, []);

  useEffect(() => {
    // Running timers are counted up to the moment of the answer; coming back to the tab
    // recounts them. The shown report stays in place until the new one arrives.
    const refresh = () => setRefreshes((count) => count + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    if (!query.valid) return;
    // Switching presets quickly can let an older, slower answer arrive last; it is ignored.
    let isLatest = true;
    apiClient.getReport(query).then(
      (report) => isLatest && setResult({ key: query.key, report }),
      (error) => isLatest && setResult({ key: query.key, error: describeError(error) }),
    );
    return () => {
      isLatest = false;
    };
  }, [query, refreshes]);

  const current = query.valid && result?.key === query.key ? result : undefined;

  function retry() {
    setResult(undefined); // so "Считаю…" replaces the error at once
    setRefreshes((count) => count + 1);
  }

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
          <Button variant="secondary" onClick={retry}>
            Повторить
          </Button>
        </div>
      ) : (
        current.report && <ReportTable report={current.report} />
      )}
    </div>
  );
}
