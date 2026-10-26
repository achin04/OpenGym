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
