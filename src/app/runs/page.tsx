import Link from "next/link";
import {
  formatDateTime,
  formatLabel,
  formatPrice,
  formatTimeRange,
} from "@/lib/formatters";
import type { Prisma } from "@/generated/prisma/client";
import { ResetRunsFiltersButton } from "@/app/runs/_components/reset-runs-filters-button";
import { SourceFilterWithAdvanced } from "@/app/runs/_components/source-filter-with-advanced";
import {
  AgeGroup,
  RunSourceType,
  SkillLevel,
  SourceRunStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";

type RunsPageProps = {
  searchParams: Promise<{
    location?: string | string[];
    availability?: string | string[];
    skillLevel?: string | string[];
    ageGroup?: string | string[];
    sourceType?: string | string[];
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

const sourceOptions = [
  { value: "", label: "All runs" },
  { value: RunSourceType.USER, label: "User created" },
  { value: RunSourceType.CITY, label: "City of Toronto" },
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

function getResultsLabel(count: number, location: string) {
  const noun = count === 1 ? "run" : "runs";

  if (location) {
    return `${count} ${noun} found near ${location}`;
  }

  return `${count} ${noun} found`;
}

function isImportedRun(sourceType: RunSourceType) {
  return sourceType !== RunSourceType.USER;
}

function runSourceLabel(sourceType: RunSourceType) {
  if (sourceType === RunSourceType.CITY) {
    return "City of Toronto";
  }

  return formatLabel(sourceType);
}

export default async function RunsPage({ searchParams }: RunsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const location = cleanParam(params.location);
  const availability = parseAvailability(params.availability);
  const skillLevel = parseEnumValue(SkillLevel, params.skillLevel);
  const ageGroup = parseEnumValue(AgeGroup, params.ageGroup);
  const sourceType = parseEnumValue(RunSourceType, params.sourceType);
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
    ...(sourceType
      ? {
          sourceType,
        }
      : {}),
  };

  const runs = await prisma.run.findMany({
    where,
    include: {
      venue: true,
    },
    orderBy: {
      startTime: "asc",
    },
    take: 48,
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
              {location ? `Runs near ${location}` : "Find a run that fits your week"}
            </h1>
            <p className="max-w-2xl text-cream/62">
              Search by city, neighborhood, venue, or postal code. Results are
              shown by start time.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-ink-900/72 p-4">
            <p className="text-sm font-medium text-cream/52">Runs found</p>
            <p className="mt-2 text-2xl font-semibold text-court-200">
              {runs.length}
            </p>
            <p className="mt-1 text-xs text-cream/45">
              Filtered by your current search.
            </p>
          </div>
        </div>

        <form
          action="/runs"
          className="grid gap-3 rounded-lg border border-line bg-ink-900/78 p-3 shadow-2xl shadow-black/20 lg:grid-cols-[minmax(12rem,1.5fr)_repeat(2,minmax(9rem,1fr))_auto]"
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

          <SourceFilterWithAdvanced
            key={`${sourceType}:${skillLevel}:${ageGroup}`}
            sourceType={sourceType}
            skillLevel={skillLevel}
            ageGroup={ageGroup}
            sourceOptions={sourceOptions}
            skillOptions={skillOptions}
            ageOptions={ageOptions}
          />

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="min-h-11 rounded-md bg-court px-4 text-sm font-semibold text-background transition hover:bg-court-200 focus:outline-none focus:ring-2 focus:ring-court/50"
            >
              Search
            </button>

            <ResetRunsFiltersButton />
          </div>

        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm font-medium text-cream/62">
            {getResultsLabel(runs.length, location)}
          </p>
          <Link
            href="/runs/new"
            className="rounded-md border border-court/45 px-3 py-2 text-sm font-semibold text-court-200 transition hover:bg-court/10"
          >
            Add a run
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-lg border border-line bg-ink-900/72 p-8 text-cream/68">
            <p className="text-lg font-semibold text-cream">
              No runs found for those filters yet.
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
            {runs.map((run) => {
              const importedRun = isImportedRun(run.sourceType);

              return (
              <article
                key={run.id}
                className={
                  importedRun
                    ? "group border-l-4 border-l-sky-400/70 border-y border-r border-y-line border-r-line bg-[#0f1418]/86 p-5 transition hover:border-l-sky-300 hover:bg-[#111923]"
                    : "group rounded-lg border border-court/35 bg-ink-900/74 p-5 shadow-lg shadow-court/5 transition hover:border-court/60 hover:bg-ink-900/95"
                }
              >
                <div className="grid gap-5 md:grid-cols-[7.25rem_minmax(0,1fr)_auto] md:items-start">
                  <div
                    className={
                      importedRun
                        ? "border border-sky-400/25 bg-sky-400/8 p-4 text-center"
                        : "rounded-md border border-court/30 bg-court/8 p-4 text-center"
                    }
                  >
                    <p
                      className={
                        importedRun
                          ? "text-xs font-semibold uppercase tracking-[0.14em] text-sky-200"
                          : "text-xs font-semibold uppercase tracking-[0.14em] text-court-200"
                      }
                    >
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
                        <span
                          className={
                            importedRun
                              ? "rounded-full border border-sky-300/25 px-2.5 py-1 text-xs font-medium text-sky-100/75"
                              : "rounded-full bg-court px-2.5 py-1 text-xs font-semibold text-background"
                          }
                        >
                          {importedRun ? runSourceLabel(run.sourceType) : "User run"}
                        </span>
                      </div>

                      {importedRun ? null : (
                        <>
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
                        </>
                      )}
                    </div>

                    <dl
                      className={
                        importedRun
                          ? "grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"
                          : "grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-6"
                      }
                    >
                      <div>
                        <dt className="text-cream/38">Time</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {formatTimeRange(run.startTime, run.endTime)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">Address</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {run.venue.addressLine1}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">City</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {run.venue.city}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-cream/38">Age</dt>
                        <dd className="mt-1 font-medium text-cream">
                          {formatLabel(run.ageGroup)}
                        </dd>
                      </div>

                      {importedRun ? null : (
                        <>
                          <div>
                            <dt className="text-cream/38">Level</dt>
                            <dd className="mt-1 font-medium text-cream">
                              {formatLabel(run.skillLevel)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-cream/38">Price</dt>
                            <dd className="mt-1 font-medium text-cream">
                              {formatPrice(run.price)}
                            </dd>
                          </div>

                        </>
                      )}
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
