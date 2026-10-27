"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, describeError } from "@/lib/api-client";
import type { EmployeeWithTimer } from "@/server/tracking/types";
import { AddEmployeeForm } from "./add-employee-form";
import { EmployeeRow } from "./employee-row";

type BoardState =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; employees: EmployeeWithTimer[] };

export function EmployeesBoard() {
  const [state, setState] = useState<BoardState>({ status: "loading" });

  // State is set only in the promise callbacks, once the answer arrives: setting it
  // synchronously inside the effect below would cost an extra render pass.
  const reload = useCallback(
    () =>
      apiClient.listEmployees().then(
        (employees) => setState({ status: "ready", employees }),
        (error) => setState({ status: "failed", message: describeError(error) }),
      ),
    [],
  );

  useEffect(() => {
    void reload();
    // Someone may have started or stopped a timer in another tab meanwhile.
    const reloadOnFocus = () => void reload();
    window.addEventListener("focus", reloadOnFocus);
    return () => window.removeEventListener("focus", reloadOnFocus);
  }, [reload]);

  return (
    <section aria-labelledby="employees-title" className="space-y-8">
      <div className="space-y-2">
        <h1 id="employees-title" className="text-3xl font-semibold tracking-tight">
          Сотрудники
        </h1>
        <p className="text-muted">
          Запустите таймер, когда берётесь за задачу, и остановите, когда закончили.
        </p>
      </div>

      <AddEmployeeForm onAdded={reload} />

      {state.status === "loading" && <p className="text-sm text-muted">Загрузка…</p>}
      {state.status === "failed" && (
        <p role="alert" className="text-sm text-alert">
          {state.message}
        </p>
      )}
      {state.status === "ready" &&
        (state.employees.length === 0 ? (
          <p className="border-y border-rule py-8 text-muted">
            Пока никого нет. Добавьте сотрудника, чтобы запускать его таймер.
          </p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {state.employees.map((employee) => (
              <EmployeeRow key={employee.id} employee={employee} onChange={reload} />
            ))}
          </ul>
        ))}
    </section>
  );
}
