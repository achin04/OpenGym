export type AvailabilityFilter =
  | "upcoming"
  | "today"
  | "tonight"
  | "week"
  | "weekend"
  | "any";

export const availabilityOptions: {
  value: AvailabilityFilter;
  label: string;
}[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "tonight", label: "Tonight" },
  { value: "week", label: "Next 7 days" },
  { value: "weekend", label: "Weekend" },
  { value: "any", label: "Any time" },
];

// Shaped to drop straight into a Prisma `startTime` filter. `gte` is required
// rather than optional because every listing has a lower bound - see notBefore.
export type AvailabilityRange = {
  gte: Date;
  lte?: Date;
  lt?: Date;
};

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

// A run that has already started is not something anyone can turn up to, so no
// filter should surface one. Clamping here rather than inside each branch means
// a new availability option cannot forget to do it - which is exactly how "Any
// time" ended up listing runs from months earlier, and how "Weekend" listed
// finished runs when viewed on a Saturday.
function notBefore(range: AvailabilityRange, now: Date): AvailabilityRange {
  return {
    ...range,
    gte: range.gte.getTime() > now.getTime() ? range.gte : now,
  };
}

function rangeFor(
  availability: AvailabilityFilter,
  now: Date,
): AvailabilityRange {
  if (availability === "any") {
    // Open-ended forward, which is what "any time" should have always meant:
    // no upper bound, but still only runs that have not happened yet.
    return {
      gte: now,
    };
  }

  if (availability === "today") {
    return {
      gte: now,
      lte: endOfDay(now),
    };
  }

  if (availability === "tonight") {
    const tonightStart = new Date(now);
    tonightStart.setHours(Math.max(now.getHours(), 17), 0, 0, 0);
    const tonightEnd = new Date(now);
    tonightEnd.setHours(23, 59, 59, 999);

    return {
      gte: tonightStart,
      lte: tonightEnd,
    };
  }

  if (availability === "weekend") {
    const day = now.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const weekendStart = startOfDay(addDays(now, daysUntilSaturday));
    const weekendEnd = startOfDay(addDays(weekendStart, 2));

    return {
      gte: weekendStart,
      lt: weekendEnd,
    };
  }

  return {
    gte: now,
    lte: addDays(now, availability === "week" ? 7 : 60),
  };
}

export function getAvailabilityRange(
  availability: AvailabilityFilter,
  now: Date,
): AvailabilityRange {
  return notBefore(rangeFor(availability, now), now);
}
