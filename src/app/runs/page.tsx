import Link from "next/link";
import {
  formatDateTime,
  formatLabel,
  formatPrice,
  formatTimeRange,
} from "@/lib/formatters";
import type { Prisma } from "@/generated/prisma/client";
import { AgeGroup, RsvpStatus, SkillLevel, SourceRunStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";

type RunsPageProps = {
  searchParams: Promise<{
    location?: string | string[];
    availability?: string | string[];
    skillLevel?: string | string[];
    ageGroup?: string | string[];
  }>;
};

type AvailabilityFilter = "upcoming" | "today" | "tonight" | "week" | "weekend" | "any";

const availabilityOptions: { value: AvailabilityFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "tonight", label: "Tonight" },
  { value: "week", label: "Next 7 days" },
  { value: "weekend", label: "Weekend" },
  { value: "any", label: "Any time" },
];

const skillOptions = [
  { value: "", label: "Any level" },
  ...Object.values(SkillLevel).map((value) => ({
    value,
    label: formatLabel(value),
  })),
];

const ageOptions = [
  { value: "", label: "Any age" },
  ...Object.values(AgeGroup).map((value) => ({
    value,
    label: formatLabel(value),
  })),
];

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value: string | string[] | undefined) {
  return singleParam(value)?.trim() ?? "";
}

function parseAvailability(value: string | string[] | undefined): AvailabilityFilter {
  const candidate = cleanParam(value);
  return availabilityOptions.some((option) => option.value === candidate)
    ? (candidate as AvailabilityFilter)
    : "upcoming";
}

function parseEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string | string[] | undefined,
) {
  const candidate = cleanParam(value);
  return Object.values(enumObject).includes(candidate)
    ? (candidate as T[keyof T])
    : "";
}

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

function getAvailabilityRange(availability: AvailabilityFilter, now: Date) {
  if (availability === "any") {
    return undefined;
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

function includesText(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

type RunMatch = Awaited<ReturnType<typeof prisma.run.findMany>>[number] & {
  venue: {
    name: string;
    addressLine1: string;
    city: string;
  };
  rsvps: { id: string }[];
};

function scoreRun(run: RunMatch, filters: { location: string; skillLevel: string; ageGroup: string }, now: Date) {
  let score = 0;

  if (filters.location) {
    const location = filters.location.toLowerCase();

    if (run.venue.city.toLowerCase() === location) {
      score += 80;
    } else if (includesText(run.venue.city, location)) {
      score += 58;
    }

    if (includesText(run.venue.name, location)) {
      score += 34;
    }

    if (includesText(run.venue.addressLine1, location)) {
      score += 24;
    }

    if (includesText(run.title, location) || includesText(run.description, location)) {
      score += 12;
    }
  } else {
    score += 8;
  }

  if (filters.skillLevel && run.skillLevel === filters.skillLevel) {
    score += 12;
  }

  if (filters.ageGroup && run.ageGroup === filters.ageGroup) {
    score += 10;
  }

  if (run.verified) {
    score += 10;
  }

  if (run.startTime >= now) {
    const hoursAway = (run.startTime.getTime() - now.getTime()) / 3_600_000;
    score += 18;

    if (hoursAway <= 24) {
      score += 16;
    } else if (hoursAway <= 72) {
      score += 10;
    } else if (hoursAway <= 168) {
      score += 6;
    }
  }

  if (run.maxPlayers == null || run.rsvps.length < run.maxPlayers) {
    score += 5;
  }

  return score;
}

function getSpotsLabel(goingCount: number, maxPlayers: number | null) {
  if (maxPlayers == null) {
    return `${goingCount} going`;
  }

  const spotsLeft = Math.max(maxPlayers - goingCount, 0);

  if (spotsLeft === 0) {
    return "Full";
  }

  return `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`;
}

function getResultsLabel(count: number, location: string) {
  const noun = count === 1 ? "run" : "runs";

  if (location) {
    return `${count} ${noun} matched near ${location}`;
  }

  return `${count} ${noun} matched your filters`;
}

export default async function RunsPage({ searchParams }: RunsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const location = cleanParam(params.location);
  const availability = parseAvailability(params.availability);
  const skillLevel = parseEnumValue(SkillLevel, params.skillLevel);
  const ageGroup = parseEnumValue(AgeGroup, params.ageGroup);
  const availabilityRange = getAvailabilityRange(availability, now);

  const locationFilter: Prisma.RunWhereInput | undefined = location
    ? {
        OR: [
          {
            title: {
              contains: location,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: location,
              mode: "insensitive",
            },
          },
          {
            venue: {
              is: {
                OR: [
                  {
                    city: {
                      contains: location,
                      mode: "insensitive",
                    },
                  },
                  {
                    name: {
                      contains: location,
                      mode: "insensitive",
                    },
                  },
                  {
                    addressLine1: {
                      contains: location,
                      mode: "insensitive",
                    },
                  },
                  {
                    postalCode: {
                      contains: location,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          },
        ],
      }
    : undefined;

  const where: Prisma.RunWhereInput = {
    sourceStatus: SourceRunStatus.ACTIVE,
    ...(availabilityRange
      ? {
          startTime: availabilityRange,
        }
      : {}),
    ...(locationFilter ? locationFilter : {}),
    ...(skillLevel
      ? {
          skillLevel,
        }
      : {}),
    ...(ageGroup
      ? {
          ageGroup,
        }
      : {}),
  };

  const runs = await prisma.run.findMany({
    where,
    include: {
      venue: true,
      rsvps: {
        where: {
          status: RsvpStatus.GOING,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      startTime: "asc",
    },
    take: 48,
  });

  const rankedRuns = runs
    .map((run) => ({
      run,
      score: Math.min(100, scoreRun(run, { location, skillLevel, ageGroup }, now)),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.run.startTime.getTime() - right.run.startTime.getTime();
    });

  return (
    <main className="min-h-screen px-5 py-8 text-cream sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
              Basketball Runs
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
              {location ? `Best runs near ${location}` : "Find a run that fits your week"}
            </h1>
            <p className="max-w-2xl text-cream/62">
              Search by city, neighborhood, venue, or postal code. Results are
              ranked by area fit, availability, verification, and open spots.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-ink-900/72 p-4">
            <p className="text-sm font-medium text-cream/52">Match signal</p>
            <p className="mt-2 text-2xl font-semibold text-court-200">
              {rankedRuns.length > 0 ? `${rankedRuns[0]?.score}%` : "0%"}
            </p>
            <p className="mt-1 text-xs text-cream/45">
              Top relevance score for the current filters.
            </p>
          </div>
        </div>

        <form
          action="/runs"
          className="grid gap-3 rounded-lg border border-line bg-ink-900/78 p-3 shadow-2xl shadow-black/20 lg:grid-cols-[minmax(12rem,1.5fr)_repeat(3,minmax(9rem,1fr))_auto]"
        >
          <div className="grid gap-1">
            <label
              htmlFor="location"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
            >
              City or area
            </label>
            <input
              id="location"
              name="location"
              type="search"
              defaultValue={location}
              autoComplete="address-level2"
              placeholder="Toronto, gym, postal code"
              className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
            />
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="availability"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
            >
              Availability
            </label>
            <select
              id="availability"
              name="availability"
              defaultValue={availability}
              className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
            >
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="skillLevel"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
            >
              Skill
            </label>
            <select
              id="skillLevel"
              name="skillLevel"
              defaultValue={skillLevel}
              className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
            >
              {skillOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="ageGroup"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
            >
              Age
            </label>
            <select
              id="ageGroup"
              name="ageGroup"
              defaultValue={ageGroup}
              className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
            >
              {ageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="min-h-11 rounded-md bg-court px-4 text-sm font-semibold text-background transition hover:bg-court-200 focus:outline-none focus:ring-2 focus:ring-court/50"
            >
              Search
            </button>

            <Link
              href="/runs"
              className="min-h-11 rounded-md border border-line px-4 py-3 text-sm font-semibold text-cream/70 transition hover:border-court/50 hover:text-cream"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm font-medium text-cream/62">
            {getResultsLabel(rankedRuns.length, location)}
          </p>
          <Link
            href="/runs/new"
            className="rounded-md border border-court/45 px-3 py-2 text-sm font-semibold text-court-200 transition hover:bg-court/10"
          >
            Add a run
          </Link>
        </div>

        {rankedRuns.length === 0 ? (
          <div className="rounded-lg border border-line bg-ink-900/72 p-8 text-cream/68">
            <p className="text-lg font-semibold text-cream">
              No runs match those filters yet.
            </p>
            <p className="mt-2 max-w-2xl">
              Try a broader area, switch availability to any time, or check back
              after the next import. The board is ready for fresh runs as soon
              as they land.
            </p>
            <Link
              href="/runs?availability=any"
              className="mt-5 inline-flex rounded-md bg-court px-4 py-2 text-sm font-semibold text-background transition hover:bg-court-200"
            >
              Browse all runs
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {rankedRuns.map(({ run, score }, index) => {
              const goingCount = run.rsvps.length;

              return (
              <article
                key={run.id}
                className="group rounded-lg border border-line bg-ink-900/68 p-5 transition hover:border-court/45 hover:bg-ink-900/90"
              >
                <div className="grid gap-5 md:grid-cols-[7.25rem_minmax(0,1fr)_auto] md:items-start">
                  <div className="rounded-md border border-court/30 bg-court/8 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-court-200">
                      {new Intl.DateTimeFormat("en-CA", {
                        weekday: "short",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-cream">
                      {new Intl.DateTimeFormat("en-CA", {
                        day: "2-digit",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                    <p className="mt-1 text-xs text-cream/50">
                      {new Intl.DateTimeFormat("en-CA", {
                        month: "short",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {index === 0 ? (
                          <span className="rounded-full bg-court px-2.5 py-1 text-xs font-semibold text-background">
                            Top match
                          </span>
                        ) : null}
                        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-cream/62">
                          {score}% match
                        </span>
                        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-cream/62">
                          {run.verified ? "Verified" : "Community listed"}
                        </span>
                      </div>

                      <h2 className="text-2xl font-semibold text-cream">
                        <Link
                          href={`/runs/${run.id}`}
                          className="transition group-hover:text-court-200"
                        >
                          {run.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-cream/62">
                        {run.venue.name} · {run.venue.city} ·{" "}
                        {run.venue.addressLine1}
                      </p>
                    </div>

                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-cream/38">Time</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {formatTimeRange(run.startTime, run.endTime)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">Price</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {formatPrice(run.price)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">Level</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {formatLabel(run.skillLevel)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">Roster</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {getSpotsLabel(goingCount, run.maxPlayers)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    <span className="text-sm text-cream/48">
                      {formatDateTime(run.startTime)}
                    </span>
                    <Link
                      href={`/runs/${run.id}`}
                      className="rounded-md bg-cream px-4 py-2 text-sm font-semibold text-background transition hover:bg-court-200"
                    >
                      View run
                    </Link>
                  </div>
                </div>
              </article>
            );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
