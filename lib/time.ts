const IST_TZ = "Asia/Kolkata";

export interface ISTParts {
  dateStr: string; // YYYY-MM-DD
  weekday: string; // "Monday" .. "Sunday"
  hour: number;
}

export function getISTParts(date: Date = new Date()): ISTParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
  };
}

/** Whole IST calendar days between a start date and now (0 on the start day itself). */
export function daysSinceIST(start: Date, now: Date = new Date()): number {
  const startDateStr = getISTParts(start).dateStr;
  const nowDateStr = getISTParts(now).dateStr;
  const startUtc = Date.parse(`${startDateStr}T00:00:00Z`);
  const nowUtc = Date.parse(`${nowDateStr}T00:00:00Z`);
  return Math.floor((nowUtc - startUtc) / (24 * 60 * 60 * 1000));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Days from `from` to the next occurrence of `target` (0 if they're the same day). */
export function daysUntilWeekday(target: string, from: string): number {
  const t = WEEKDAYS.indexOf(target);
  const f = WEEKDAYS.indexOf(from);
  if (t === -1 || f === -1) return 0;
  return (t - f + 7) % 7;
}

/** UTC instants for the start/end of an IST calendar day (India has no DST, so +05:30 is always safe). */
export function getISTDayBoundsUTC(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
