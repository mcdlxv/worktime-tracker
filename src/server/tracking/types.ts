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

export interface TrackingService {
  addEmployee(input: { name: string }): Promise<Employee>;
  /** Sorted by name using Russian collation. */
  listEmployees(): Promise<EmployeeWithTimer[]>;
  startTimer(employeeId: number, input: { description: string }): Promise<TimeEntry>;
  /** Closes the running entry at the current time and returns it. */
  stopTimer(employeeId: number): Promise<TimeEntry>;
}
