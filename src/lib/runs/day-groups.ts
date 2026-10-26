/**
 * Splits a run listing into calendar days.
 *
 * "Saturday" has to mean Saturday in Toronto, not in whatever zone the server
 * happens to run in -- on Vercel that is UTC, where a 7pm Saturday run is
 * already Sunday. Every date decision here therefore goes through Intl with an
 * explicit time zone rather than through the Date getters, which read the
 * host's zone.
 *
 * The same reasoning covers "today": it is today in Toronto, derived from the
 * caller's `now` so tests can fix it and the server and client cannot disagree
 * about it.
 */
const TIME_ZONE = "America/Toronto";

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  weekday: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
});

export type DayGroup<T> = {
  /** The Toronto calendar day, as YYYY-MM-DD. Stable enough for a React key. */
  key: string;
  /** "Today", "Tomorrow", or the weekday. */
  label: string;
  /** The date beside the label; omits the weekday when the label already is one. */
  dateLabel: string;
  items: T[];
};

/** YYYY-MM-DD for the Toronto day this instant falls in. */
export function torontoDayKey(date: Date): string {
  return keyFormatter.format(date);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => Date,
  now: Date,
): DayGroup<T>[] {
  const todayKey = torontoDayKey(now);
  const tomorrowKey = torontoDayKey(addDays(now, 1));

  // A Map keeps insertion order, so the groups come out in the order the
  // listing already sorted them rather than needing a second sort.
  const groups = new Map<string, { date: Date; items: T[] }>();

  for (const item of items) {
    const date = getDate(item);
    const key = torontoDayKey(date);
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { date, items: [item] });
    }
  }

  return [...groups.entries()].map(([key, group]) => {
    const isToday = key === todayKey;
    const isTomorrow = key === tomorrowKey;
    const weekday = weekdayFormatter.format(group.date);
    const shortDate = shortDateFormatter.format(group.date);

    return {
      key,
      label: isToday ? "Today" : isTomorrow ? "Tomorrow" : weekday,
      // "Saturday · Saturday, Oct 31" would say it twice, so the weekday is
      // dropped from the date once the label is already carrying it.
      dateLabel:
        isToday || isTomorrow ? `${weekday}, ${shortDate}` : shortDate,
      items: group.items,
    };
  });
}
