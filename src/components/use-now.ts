import { useEffect, useState } from "react";

/**
 * The current time, refreshed every second. Callers compute elapsed time as now − startedAt
 * rather than by counting ticks, so a throttled background tab does not drift.
 * Meant for components that only render in the browser: on the server "now" would differ
 * from the client's and break hydration. The employee rows mount once their data arrives.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
