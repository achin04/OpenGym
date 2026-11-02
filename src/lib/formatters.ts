export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "America/Toronto",
  }).format(date);
}

export function formatTimeRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

/**
 * The length of a run, as "45 min", "1 hr" or "1 hr 30 min".
 *
 * Computed from the two timestamps rather than stored, and deliberately coarse:
 * the listing shows it beside the time range as a glance-level "is this worth
 * crossing town for", not as a precise figure.
 */
export function formatDuration(start: Date, end: Date) {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatPrice(price: { toString: () => string } | null) {
  if (price === null) {
    return "Free";
  }

  const amount = Number(price.toString());

  if (amount === 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

export function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * A clock time split into the number and its unit, e.g. 11:30 + "a.m.".
 *
 * The run detail page sets the two at different sizes -- 34px for the time and
 * 20px for the meridiem -- so they have to be separate strings. Produced by
 * splitting Intl's output rather than by formatting twice, so the two halves
 * can never disagree about which hour they describe.
 */
export function splitClockTime(date: Date): { time: string; unit: string } {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(date);

  // en-CA renders "11:30 a.m."; the separator may be a narrow no-break space.
  const match = /^(\S+)\s+(.*)$/.exec(formatted.replace(/\u202f|\u00a0/g, " "));

  return match
    ? { time: match[1]!, unit: match[2]! }
    : { time: formatted, unit: "" };
}

/**
 * How long a run lasts, split the same way: 1.5 + "hrs".
 *
 * Hours carry at most one decimal, because a gym booking is a round number of
 * half hours in practice and "1.4833 hrs" would be noise. Anything under an
 * hour stays in minutes, where "0.8 hrs" would make a reader do arithmetic.
 */
export function formatRunLength(
  start: Date,
  end: Date,
): { value: string; unit: string } {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  if (minutes < 60) {
    return { value: String(minutes), unit: "min" };
  }

  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;

  return {
    value: String(rounded),
    unit: rounded === 1 ? "hr" : "hrs",
  };
}

/** "Monday, October 26" -- the date line above the stat strip. */
export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(date);
}
