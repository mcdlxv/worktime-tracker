import { type FormEvent, useState } from "react";
import { Button, TextInput } from "@/components/ui";
import { apiClient, describeError } from "@/lib/api-client";
import { formatTime } from "@/lib/format";
import type { EmployeeWithTimer } from "@/server/tracking/types";
import { LiveClock } from "./live-clock";

export function EmployeeRow({
  employee,
  onChange,
}: {
  employee: EmployeeWithTimer;
  onChange: () => Promise<void>;
}) {
  const running = employee.runningEntry;
  const [task, setTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Sends one request, then reloads the list whatever the outcome: after a 409 because the
   * timer was started in another tab, the row should show what is really going on.
   */
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(describeError(failure));
    }
    await onChange();
    setBusy(false);
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => {
      await apiClient.startTimer(employee.id, task);
      setTask("");
    });
  }

  const taskInputId = `task-${employee.id}`;
  const errorId = `employee-${employee.id}-error`;

  return (
    <li
      className={running ? "border-l-4 border-lamp bg-lamp-soft py-4 pr-4 pl-4" : "py-4 pr-4 pl-5"}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="min-w-40 flex-1 font-medium">{employee.name}</p>

        {/* min-w-0 on both blocks: a flex item will not shrink below its content's width
            by default, and the one-line task description would push the stop button off a
            phone screen. On phones the description takes a line of its own. */}
        {running ? (
          <div className="flex min-w-0 flex-[2] basis-72 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:flex-nowrap sm:justify-end">
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1 sm:text-right">
              <p className="truncate text-sm" title={running.description}>
                {running.description}
              </p>
              <p className="text-xs text-muted">с {formatTime(running.startedAt)}</p>
            </div>
            <LiveClock startedAt={running.startedAt} />
            <Button
              variant="stop"
              disabled={busy}
              onClick={() => void perform(() => apiClient.stopEntry(running.id))}
            >
              Остановить
            </Button>
          </div>
        ) : (
          <form onSubmit={start} noValidate className="flex min-w-0 flex-[2] basis-72 gap-2">
            <label htmlFor={taskInputId} className="sr-only">
              Задача для сотрудника {employee.name}
            </label>
            <TextInput
              id={taskInputId}
              value={task}
              onChange={(event) => {
                setTask(event.target.value);
                setError(null);
              }}
              placeholder="Над чем работаете?"
              maxLength={200}
              autoComplete="off"
              aria-describedby={error ? errorId : undefined}
            />
            <Button type="submit" variant="secondary" disabled={busy}>
              Начать
            </Button>
          </form>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
    </li>
  );
}
