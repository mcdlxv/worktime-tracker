// Demo data lays its workdays out in a named time zone. On Vercel a function always runs in
// UTC (TZ is a reserved variable there), so local Date methods would put "09:00" at 09:00 UTC.

/** A date on the calendar; month runs 1–12, weekday 0 (Sunday) to 6 (Saturday). */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

const fromUtcDate = (date: Date): CalendarDate => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
  weekday: date.getUTCDay(),
});

/** The fields of the wall clock in `timeZone` at this instant, by name. */
function wallClockParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** The date that a calendar on the wall in `timeZone` shows at this instant. */
export function calendarDate(instant: number, timeZone: string): CalendarDate {
  const { year, month, day } = wallClockParts(instant, timeZone);
  return fromUtcDate(new Date(Date.UTC(year, month - 1, day)));
}

/** The date `days` days later, or earlier if negative; month and year ends roll over. */
export function addDays(
  { year, month, day }: Pick<CalendarDate, "year" | "month" | "day">,
  days: number,
): CalendarDate {
  return fromUtcDate(new Date(Date.UTC(year, month - 1, day + days)));
}

/** How far the wall clock in `timeZone` is ahead of UTC at this instant, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const { year, month, day, hour, minute, second } = wallClockParts(instant, timeZone);
  return Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant when the wall clock in `timeZone` shows this date and time. Minutes past 59
 * roll over into the next hour, as with Date. The offset depends on the instant itself, so
 * a second pass settles the days when it changes, such as a switch to or from summer time.
 */
export function wallClockTime(
  {
    year,
    month,
    day,
    hour,
    minute,
  }: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): number {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = asIfUtc - offsetAt(asIfUtc, timeZone);
  return asIfUtc - offsetAt(firstGuess, timeZone);
}
