import Link from "next/link";
import {
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
} from "@/generated/prisma/enums";
import {
  availabilityOptions,
  getAvailabilityRange,
  type AvailabilityFilter,
} from "@/lib/runs/availability";
import { RunsPagination } from "@/app/runs/_components/runs-pagination";
import { VenueFilterChip } from "@/app/runs/_components/venue-filter-chip";
import { publicRunFilter } from "@/lib/runs/public-runs";
import {
  buildRunsPagination,
  parsePageParam,
} from "@/lib/runs/pagination";
import { prisma } from "@/server/db";

type RunsPageProps = {
  searchParams: Promise<{
    location?: string | string[];
    availability?: string | string[];
    skillLevel?: string | string[];
    ageGroup?: string | string[];
    sourceType?: string | string[];
    venueId?: string | string[];
    page?: string | string[];
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

// Reports the size of the whole result set rather than of the current page, so
// the number means what it says when the listing runs to dozens of pages.
function getResultsLabel(
  count: number,
  location: string,
  page: number,
  pageCount: number,
) {
  const noun = count === 1 ? "run" : "runs";
  const found = location
    ? `${count} ${noun} found near ${location}`
    : `${count} ${noun} found`;

  return pageCount > 1 ? `${found} · page ${page} of ${pageCount}` : found;
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
  const venueIdParam = cleanParam(params.venueId);

  // Resolved to a real row rather than trusted, for two reasons: the chip needs
  // the venue's name, and an id that no longer exists must not silently filter
  // the listing down to nothing. An unknown id is dropped, so a stale map link
  // degrades to the full listing instead of an empty page with no explanation.
  const venue = venueIdParam
    ? await prisma.venue.findUnique({
        where: { id: venueIdParam },
        select: { id: true, name: true },
      })
    : null;

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
    // sourceStatus + the time bound now come from publicRunFilter, which the
    // home map queries through as well so the two views cannot disagree about
    // which runs are public. Always bounded: getAvailabilityRange floors every
    // option at the present, so a past run can never appear in the listing.
    ...publicRunFilter(availabilityRange),
    ...(venue ? { venueId: venue.id } : {}),
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

  // Counted before fetching rather than alongside, because the page has to be
  // clamped to one that exists before it can be turned into a skip.
  const totalCount = await prisma.run.count({ where });
  const pagination = buildRunsPagination(
    parsePageParam(params.page),
    totalCount,
  );
  const runs = await prisma.run.findMany({
    where,
    include: {
      venue: true,
    },
    orderBy: {
      startTime: "asc",
    },
    skip: pagination.skip,
    take: pagination.take,
  });
  // Rebuilt from the parsed values rather than passed through, so a clamped or
  // junk page number cannot leak into the page links.
  const filterParams = {
    location,
    availability,
    skillLevel,
    ageGroup,
    sourceType,
    // Carried here so page links keep the venue filter. The matching hidden
    // input in the form below does the same job for filter submissions.
    ...(venue ? { venueId: venue.id } : {}),
  };

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
              {venue
                ? `Runs at ${venue.name}`
                : location
                  ? `Runs near ${location}`
                  : "Find a run that fits your week"}
            </h1>
            <p className="max-w-2xl text-foreground/70">
              Search by city, neighborhood, venue, or postal code. Results are
              shown by start time.
            </p>
          </div>

          <div className="rounded-[16px] border-2 border-foreground bg-surface p-5 shadow-[0_4px_0_0_var(--foreground)]">
            <p className="text-sm font-semibold text-foreground/60">Runs found</p>
            <p className="mt-2 text-2xl font-semibold text-court">
              {totalCount}
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
          {/*
            A form submits only its own fields, so without this the venue
            filter would silently disappear the moment the visitor changed
            availability or source -- they would be thrown back to every run in
            the city with nothing explaining why.
          */}
          {venue ? (
            <input type="hidden" name="venueId" value={venue.id} />
          ) : null}

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

        {venue ? (
          <VenueFilterChip venueName={venue.name} params={filterParams} />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-4">
          <p className="text-sm font-medium text-foreground/70">
            {getResultsLabel(
              totalCount,
              location,
              pagination.page,
              pagination.pageCount,
            )}
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
                <div className="grid gap-5 md:grid-cols-[7.25rem_minmax(0,1fr)_auto] md:items-center">
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
                          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
                      }
                    >
                      <div>
                        <dt className="text-sm text-foreground/55">Time</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {formatTimeRange(run.startTime, run.endTime)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm text-foreground/55">Address</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {run.venue.addressLine1}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm text-foreground/55">City</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {run.venue.city}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm text-foreground/55">Age</dt>
                        <dd className="mt-1 text-base font-semibold text-foreground">
                          {formatLabel(run.ageGroup)}
                        </dd>
                      </div>

                      {importedRun ? null : (
                        <>
                          <div>
                            <dt className="text-sm text-foreground/55">Level</dt>
                            <dd className="mt-1 text-base font-semibold text-foreground">
                              {formatLabel(run.skillLevel)}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm text-foreground/55">Price</dt>
                            <dd className="mt-1 text-base font-semibold text-foreground">
                              {formatPrice(run.price)}
                            </dd>
                          </div>

                        </>
                      )}
                    </dl>
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <SourceChip
                      sourceType={run.sourceType}
                      label={
                        importedRun ? runSourceLabel(run.sourceType) : "User run"
                      }
                    />
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

        <RunsPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          params={filterParams}
        />
      </section>
    </main>
  );
}
