import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { EmployeeReport, Report, ReportEntry } from "@/server/tracking/types";

const ROW = "grid grid-cols-[1fr_auto_7rem] items-baseline gap-4 py-3 pr-1";

/** One line on wider screens; on a phone the description moves under date, time and duration. */
function EntryLine({ entry }: { entry: ReportEntry }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-1.5">
      <span className="w-24 text-muted">{formatDate(entry.startedAt)}</span>
      <span className="w-28 tabular-nums text-muted">
        {formatTime(entry.startedAt)}–{entry.endedAt === null ? "…" : formatTime(entry.endedAt)}
      </span>
      <span className="ml-auto tabular-nums sm:order-last">{formatDuration(entry.durationMs)}</span>
      <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
        {entry.description}
        {entry.isRunning && <span className="ml-2 text-lamp">идёт</span>}
      </span>
    </li>
  );
}

function EmployeeLine({ row }: { row: EmployeeReport }) {
  const cells = (
    <>
      {/* The commas keep a screen reader from running the name and the numbers together. */}
      <span className="text-right tabular-nums text-muted">
        <span className="sr-only">, записей: </span>
        {row.entries.length}
      </span>
      <span className="text-right font-medium tabular-nums">
        <span className="sr-only">, итого </span>
        {formatDuration(row.totalMs)}
      </span>
    </>
  );

  if (row.entries.length === 0) {
    return (
      <div className={`${ROW} border-b border-rule pl-6 text-muted`}>
        <span>{row.employee.name}</span>
        {cells}
      </div>
    );
  }

  return (
    <details className="group border-b border-rule">
      <summary className={`${ROW} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <span className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="w-4 text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
          >
            ›
          </span>
          {row.employee.name}
        </span>
        {cells}
      </summary>
      <ul className="pb-3 pl-6 text-sm">
        {row.entries.map((entry) => (
          <EntryLine key={entry.id} entry={entry} />
        ))}
      </ul>
    </details>
  );
}

export function ReportTable({ report }: { report: Report }) {
  if (report.employees.length === 0) {
    return (
      <p className="border-y border-rule py-8 text-muted">
        Сотрудников пока нет. Добавьте их на странице «Сотрудники».
      </p>
    );
  }

  const entryCount = report.employees.reduce((count, row) => count + row.entries.length, 0);

  return (
    <div>
      {report.totalMs === 0 && entryCount === 0 && (
        <p className="mb-4 text-muted">За этот период ничего не записано.</p>
      )}
      <div className="border-t border-rule">
        <div className={`${ROW} border-b border-rule pl-6 text-sm text-muted`} aria-hidden>
          <span>Сотрудник</span>
          <span className="text-right">Записей</span>
          <span className="text-right">Итого</span>
        </div>
        {report.employees.map((row) => (
          <EmployeeLine key={row.employee.id} row={row} />
        ))}
        {/* The double rule above a total, as in an accounting ledger. */}
        <div className={`${ROW} border-t-4 border-double border-ink pl-6 font-semibold`}>
          <span>Всего</span>
          <span className="text-right tabular-nums">
            <span className="sr-only">, записей: </span>
            {entryCount}
          </span>
          <span className="text-right tabular-nums">
            <span className="sr-only">, итого </span>
            {formatDuration(report.totalMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
