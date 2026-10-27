import { Button } from "@/components/ui";
import { type PeriodPreset, presetRange } from "@/lib/period";
import type { Employee } from "@/server/tracking/types";

export interface DateRange {
  fromDate: string;
  toDate: string;
}

const PRESETS: { preset: PeriodPreset; label: string }[] = [
  { preset: "today", label: "Сегодня" },
  { preset: "week", label: "Эта неделя" },
  { preset: "month", label: "Этот месяц" },
];

const fieldClass = "mt-1 block h-10 rounded-md border border-rule bg-white px-3 text-sm";

export function PeriodPicker({
  range,
  onRangeChange,
  employees,
  employeeId,
  onEmployeeChange,
}: {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  employees: Employee[];
  employeeId: number | undefined;
  onEmployeeChange: (employeeId: number | undefined) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <legend className="sr-only">Период и сотрудник</legend>

      <div className="flex gap-3">
        <label className="text-sm font-medium">
          С
          <input
            type="date"
            className={fieldClass}
            value={range.fromDate}
            onChange={(event) => onRangeChange({ ...range, fromDate: event.target.value })}
          />
        </label>
        <label className="text-sm font-medium">
          По
          <input
            type="date"
            className={fieldClass}
            value={range.toDate}
            onChange={(event) => onRangeChange({ ...range, toDate: event.target.value })}
          />
        </label>
      </div>

      <div role="group" aria-label="Быстрый выбор периода" className="flex flex-wrap gap-2">
        {PRESETS.map(({ preset, label }) => {
          const presetDates = presetRange(preset);
          const isCurrent =
            presetDates.fromDate === range.fromDate && presetDates.toDate === range.toDate;
          return (
            <Button
              key={preset}
              type="button"
              variant={isCurrent ? "primary" : "secondary"}
              aria-pressed={isCurrent}
              onClick={() => onRangeChange(presetDates)}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <label className="text-sm font-medium">
        Сотрудник
        <select
          className={`${fieldClass} min-w-48`}
          value={employeeId ?? ""}
          onChange={(event) =>
            onEmployeeChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
        >
          <option value="">Все сотрудники</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
