import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

/**
 * false during server rendering and hydration, true afterwards. Lets a component render
 * values that only the browser knows, such as today's local date, without the server HTML
 * and the first client render disagreeing.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
