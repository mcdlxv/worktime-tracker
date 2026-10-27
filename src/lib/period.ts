/**
 * Parses "YYYY-MM-DD", the value of <input type="date">, as local midnight of that day.
 * Not `new Date("2026-10-01")`: a date-only string is parsed as UTC midnight.
 */
function localMidnight(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // new Date() quietly rolls 30 February over into March; such dates are rejected.
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }
  }
  throw new RangeError("Некорректная дата");
}

/**
 * Turns the dates picked in the form, both inclusive, into the half-open period
 * [from, to) in the browser's time zone: from is local midnight of the first day,
 * to is local midnight after the last one. The next day is found by calendar
 * arithmetic rather than "+24 h", so a day with a daylight saving switch keeps its length.
 */
export function dayRangeToPeriod(fromDate: string, toDate: string): { from: string; to: string } {
  const from = localMidnight(fromDate);
  const to = localMidnight(toDate);
  if (to < from) throw new RangeError("Начало периода должно быть не позже конца");
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
