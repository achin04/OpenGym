import Link from "next/link";
import {
  formatDateTime,
  formatLabel,
  formatPrice,
  formatTimeRange,
} from "@/lib/formatters";
import type { Prisma } from "@/generated/prisma/client";
import { FIELD, FIELD_LABEL, SELECT_FIELD } from "@/app/_components/field";
import { raisedButtonClass } from "@/app/_components/raised-button";
import { ResetRunsFiltersButton } from "@/app/runs/_components/reset-runs-filters-button";
import { SourceChip } from "@/app/runs/_components/source-chip";
import { SourceFilterWithAdvanced } from "@/app/runs/_components/source-filter-with-advanced";
import {
  AgeGroup,
  RunSourceType,
  SkillLevel,
  SourceRunStatus,
} from "@/generated/prisma/enums";
import {
  availabilityOptions,
  getAvailabilityRange,
  type AvailabilityFilter,
} from "@/lib/runs/availability";
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
    // Always bounded: getAvailabilityRange floors every option at the present,
    // so a past run can never appear in the listing.
    startTime: availabilityRange,
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
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
              Basketball Runs
            </p>
            <h1 className="max-w-3xl text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
              {location ? `Runs near ${location}` : "Find a run that fits your week"}
            </h1>
            <p className="max-w-2xl text-foreground/70">
              Search by city, neighborhood, venue, or postal code. Results are
              shown by start time.
            </p>
          </div>

          <div className="rounded-[16px] border-2 border-foreground bg-surface p-5 shadow-[0_4px_0_0_var(--foreground)]">
            <p className="text-sm font-semibold text-foreground/60">Runs found</p>
            <p className="mt-2 text-2xl font-semibold text-court">
              {runs.length}
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              Filtered by your current search.
            </p>
          </div>
        </div>

        <form
          action="/runs"
          className="grid gap-4 rounded-[20px] border-2 border-foreground bg-surface p-4 shadow-[0_6px_0_0_var(--foreground)] lg:grid-cols-[minmax(12rem,1.5fr)_repeat(2,minmax(9rem,1fr))_auto]"
        >
          <div className="grid gap-1">
            <label
              htmlFor="location"
              className={FIELD_LABEL}
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
              className={FIELD}
            />
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="availability"
              className={FIELD_LABEL}
            >
              Availability
            </label>
            <select
              id="availability"
              name="availability"
              defaultValue={availability}
              className={SELECT_FIELD}
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
              className={raisedButtonClass({ variant: "solid" })}
            >
              Search
            </button>

            <ResetRunsFiltersButton />
          </div>

        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-4">
          <p className="text-sm font-medium text-foreground/70">
            {getResultsLabel(runs.length, location)}
          </p>
          <Link
            href="/runs/new"
            className={raisedButtonClass()}
          >
            Add a run
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-[20px] border-2 border-foreground bg-surface p-8 text-foreground/70 shadow-[0_6px_0_0_var(--foreground)]">
            <p className="text-lg font-semibold text-foreground">
              No runs found for those filters yet.
            </p>
            <p className="mt-2 max-w-2xl">
              Try a broader area, switch availability to any time, or check back
              after the next import. The board is ready for fresh runs as soon
              as they land.
            </p>
            <Link
              href="/runs?availability=any"
              className={`mt-5 ${raisedButtonClass({ variant: "solid" })}`}
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
                className="group rounded-[20px] border-2 border-foreground bg-surface p-5 shadow-[0_6px_0_0_var(--foreground)]"
              >
                <div className="grid gap-5 md:grid-cols-[7.25rem_minmax(0,1fr)_auto] md:items-start">
                  <div className="rounded-[10px] border-2 border-foreground bg-court/15 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/70">
                      {new Intl.DateTimeFormat("en-CA", {
                        weekday: "short",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-foreground">
                      {new Intl.DateTimeFormat("en-CA", {
                        day: "2-digit",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                    <p className="mt-1 text-xs text-foreground/60">
                      {new Intl.DateTimeFormat("en-CA", {
                        month: "short",
                        timeZone: "America/Toronto",
                      }).format(run.startTime)}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="space-y-2">
                      {importedRun ? null : (
                        <>
                          <h2 className="text-2xl font-semibold text-foreground">
                            <Link
                              href={`/runs/${run.id}`}
                              className="transition group-hover:text-court"
                            >
                              {run.title}
                            </Link>
                          </h2>
                          <p className="text-sm text-foreground/70">
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
                        <dt className="text-foreground/55">Time</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {formatTimeRange(run.startTime, run.endTime)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-foreground/55">Address</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {run.venue.addressLine1}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-foreground/55">City</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {run.venue.city}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-foreground/55">Age</dt>
                        <dd className="mt-1 font-medium text-foreground">
                          {formatLabel(run.ageGroup)}
                        </dd>
                      </div>

                      {importedRun ? null : (
                        <>
                          <div>
                            <dt className="text-foreground/55">Level</dt>
                            <dd className="mt-1 font-medium text-foreground">
                              {formatLabel(run.skillLevel)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-foreground/55">Price</dt>
                            <dd className="mt-1 font-medium text-foreground">
                              {formatPrice(run.price)}
                            </dd>
                          </div>

                        </>
                      )}
                    </dl>
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end">
                    {/* Mark and timestamp share a row so the right-hand column
                        does not grow taller than the card's own content. */}
                    <div className="flex items-center gap-3">
                      <SourceChip
                        sourceType={run.sourceType}
                        label={
                          importedRun
                            ? runSourceLabel(run.sourceType)
                            : "User run"
                        }
                      />
                      <span className="text-sm text-foreground/60">
                        {formatDateTime(run.startTime)}
                      </span>
                    </div>
                    <Link
                      href={`/runs/${run.id}`}
                      className={raisedButtonClass()}
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
