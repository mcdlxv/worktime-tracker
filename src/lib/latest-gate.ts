/**
 * Tells whether an answer still belongs to the newest request. Overlapping requests, such as
 * a reload on window focus and the one after a button press, can answer out of order; only
 * the answer to the newest one may update the screen.
 */
export function createLatestGate() {
  let newest = 0;
  return {
    /** Call when sending a request; the returned check stays true until a newer one starts. */
    begin(): () => boolean {
      const ticket = ++newest;
      return () => ticket === newest;
    },
  };
}
