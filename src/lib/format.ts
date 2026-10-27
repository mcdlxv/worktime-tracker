const MINUTE = 60_000;

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** "1 ч 02 мин", or "25 мин" under an hour. Whole minutes, rounded down. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${twoDigits(minutes)} мин` : `${minutes} мин`;
}

/**
 * "01:02:05" for a running timer; hours are not capped at 24. A negative value, which
 * appears when the browser clock lags behind the server's, is shown as zero.
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(twoDigits).join(":");
}
