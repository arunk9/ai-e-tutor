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
