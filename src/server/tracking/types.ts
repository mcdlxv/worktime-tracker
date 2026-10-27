// Domain types shared by the service, the HTTP layer and the UI.
// All times are unix milliseconds (UTC).

/** Returns the current time; injected so tests can control it. */
export type Clock = () => number;

export interface Employee {
  id: number;
  name: string;
  createdAt: number;
}

export interface TimeEntry {
  id: number;
  employeeId: number;
  description: string;
  startedAt: number;
  /** null while the timer is running */
  endedAt: number | null;
}

export interface EmployeeWithTimer extends Employee {
  runningEntry: TimeEntry | null;
}

/** A half-open interval [from, to). */
export interface Period {
  from: number;
  to: number;
}

export interface ReportEntry extends TimeEntry {
  /** Only the part of the entry that falls inside the period. */
  durationMs: number;
  isRunning: boolean;
}

export interface EmployeeReport {
  employee: Employee;
  /** In time order. */
  entries: ReportEntry[];
  totalMs: number;
}

export interface Report {
  period: Period;
  /** The "now" that running entries were counted up to. */
  generatedAt: number;
  employees: EmployeeReport[];
  totalMs: number;
}

export interface TrackingService {
  addEmployee(input: { name: string }): Promise<Employee>;
  /** Sorted by name using Russian collation. */
  listEmployees(): Promise<EmployeeWithTimer[]>;
  startTimer(employeeId: number, input: { description: string }): Promise<TimeEntry>;
  /** Closes the running entry at the current time and returns it. */
  stopTimer(employeeId: number): Promise<TimeEntry>;
}
