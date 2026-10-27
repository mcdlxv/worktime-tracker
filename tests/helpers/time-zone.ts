/**
 * Runs the check in a given time zone. CI runs in UTC and this machine in UTC+5, so a test
 * that relies on the machine's zone could pass for the wrong reason; tests name the zone.
 */
export function inTimeZone(zone: string, check: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    check();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}
