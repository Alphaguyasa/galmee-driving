const ZONE = "Africa/Addis_Ababa";
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** The Addis Ababa calendar day of an instant, as YYYY-MM-DD. */
export function addisDay(input: Date | string = new Date()): string {
  return DAY.format(new Date(input));
}

/** The Addis Ababa wall clock of an instant, as HH:MM. */
export function addisTime(input: Date | string): string {
  return TIME.format(new Date(input));
}

/** The instant of a wall-clock time in Addis Ababa (UTC+3, no daylight saving). */
export function addisInstant(day: string, time: string): string {
  return `${day}T${time}:00+03:00`;
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
