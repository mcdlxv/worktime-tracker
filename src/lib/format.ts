const MINUTE = 60_000;

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * "1 ч 02 мин", "25 мин" under an hour, "< 1 мин" under a minute. Whole minutes, rounded
 * down; only an exact zero reads "0 мин", so a short entry does not look like no work at all.
 */
export function formatDuration(ms: number): string {
  if (ms > 0 && ms < MINUTE) return "< 1 мин";
  const totalMinutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${twoDigits(minutes)} мин` : `${minutes} мин`;
}

// Dates and times are shown in the browser's time zone. The formatter options are applied
// per call rather than kept in a module-level Intl.DateTimeFormat, which would freeze the
// time zone of the moment the module was loaded.

/** "28 октября" */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** "09:05" */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * "09:00–11:30"; "09:00–…" while running; "22:00 – 27 октября 02:00" when the entry ends on
 * another day, so a night shift does not read as a few hours on its first day.
 */
export function formatEntryTimes(startedAt: number, endedAt: number | null): string {
  if (endedAt === null) return `${formatTime(startedAt)}–…`;
  if (formatDate(endedAt) === formatDate(startedAt)) {
    return `${formatTime(startedAt)}–${formatTime(endedAt)}`;
  }
  return `${formatTime(startedAt)} – ${formatDate(endedAt)} ${formatTime(endedAt)}`;
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
