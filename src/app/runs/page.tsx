import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { raisedButtonClass } from "@/app/_components/raised-button";
import { LoadMoreRuns } from "@/app/runs/_components/load-more-runs";
import { MoreFilters } from "@/app/runs/_components/more-filters";
import { RunCard } from "@/app/runs/_components/run-card";
import { RunSourceChips } from "@/app/runs/_components/run-source-chips";
import { RunsSortSelect } from "@/app/runs/_components/runs-sort";
import { VenueFilterChip } from "@/app/runs/_components/venue-filter-chip";
import { AgeGroup, RunSourceType, SkillLevel } from "@/generated/prisma/enums";
import { formatLabel } from "@/lib/formatters";
import {
  availabilityOptions,
  getAvailabilityRange,
  type AvailabilityFilter,
} from "@/lib/runs/availability";
import { groupByDay } from "@/lib/runs/day-groups";
import { buildRunsLoadMore, parseShowParam } from "@/lib/runs/load-more";
import { publicRunFilter } from "@/lib/runs/public-runs";
import { parseRunsSort } from "@/lib/runs/sort";
import { prisma } from "@/server/db";

/** The id tying the More filters popover's selects to the search form. */
const SEARCH_FORM_ID = "runs-search";

type RunsPageProps = {
  searchParams: Promise<{
    location?: string | string[];
    availability?: string | string[];
    skillLevel?: string | string[];
    ageGroup?: string | string[];
    sourceType?: string | string[];
    venueId?: string | string[];
    sort?: string | string[];
    show?: string | string[];
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

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanParam(value: string | string[] | undefined) {
  return singleParam(value)?.trim() ?? "";
}

function parseAvailability(
  value: string | string[] | undefined,
): AvailabilityFilter {
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

function SearchChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}

export default async function RunsPage({ searchParams }: RunsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const location = cleanParam(params.location);
  const availability = parseAvailability(params.availability);
  const skillLevel = parseEnumValue(SkillLevel, params.skillLevel);
  const ageGroup = parseEnumValue(AgeGroup, params.ageGroup);
  const sourceType = parseEnumValue(RunSourceType, params.sourceType);
  const sort = parseRunsSort(params.sort);
  const availabilityRange = getAvailabilityRange(availability, now);
  const venueIdParam = cleanParam(params.venueId);

  // Resolved to a real row rather than trusted: the chip needs the venue's
  // name, and an id that no longer exists must not silently filter the listing
  // down to nothing. An unknown id is dropped, so a stale map link degrades to
  // the full listing instead of an empty page with no explanation.
  const venue = venueIdParam
    ? await prisma.venue.findUnique({
        where: { id: venueIdParam },
        select: { id: true, name: true },
      })
    : null;

  const locationFilter: Prisma.RunWhereInput | undefined = location
    ? {
        OR: [
          { title: { contains: location, mode: "insensitive" } },
          { description: { contains: location, mode: "insensitive" } },
          {
            venue: {
              is: {
                OR: [
                  { city: { contains: location, mode: "insensitive" } },
                  { name: { contains: location, mode: "insensitive" } },
                  { addressLine1: { contains: location, mode: "insensitive" } },
                  { postalCode: { contains: location, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }
    : undefined;

  const where: Prisma.RunWhereInput = {
    // sourceStatus + the time bound come from publicRunFilter, which the home
    // map queries through as well so the two views cannot disagree about which
    // runs are public. Always bounded: getAvailabilityRange floors every option
    // at the present, so a past run can never appear in the listing.
    ...publicRunFilter(availabilityRange),
    ...(venue ? { venueId: venue.id } : {}),
    ...(locationFilter ? locationFilter : {}),
    ...(skillLevel ? { skillLevel } : {}),
    ...(ageGroup ? { ageGroup } : {}),
    ...(sourceType ? { sourceType } : {}),
  };

  const totalCount = await prisma.run.count({ where });
  const loadMore = buildRunsLoadMore(parseShowParam(params.show), totalCount);

  const runs = await prisma.run.findMany({
    where,
    include: {
      venue: true,
      // The community host's name. Nullable twice over: a run may have no
      // creator, and a creator may have no name.
      createdByUser: { select: { name: true } },
    },
    orderBy: { startTime: sort === "latest" ? "desc" : "asc" },
    take: loadMore.take,
  });

  const dayGroups = groupByDay(runs, (run) => run.startTime, now);

  // Rebuilt from the parsed values rather than passed through, so junk in the
  // query string cannot leak into the links this page generates.
  const filterParams = {
    location,
    availability,
    skillLevel,
    ageGroup,
    sourceType,
    sort: sort === "soonest" ? "" : sort,
    ...(venue ? { venueId: venue.id } : {}),
  };

  const hasFilters =
    location !== "" ||
    availability !== "upcoming" ||
    skillLevel !== "" ||
    ageGroup !== "" ||
    sourceType !== "" ||
    venue !== null;

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl">
        {/*
          No max-width: at the spec's 80px cap the headline needs the whole
          column to stay on one line, and clamping it to 4xl broke it across
          two where the design has one.
        */}
        <h1 className="text-[clamp(44px,6vw,80px)] font-extrabold leading-none tracking-[-0.04em]">
          {venue ? (
            <>Runs at {venue.name}</>
          ) : location ? (
            <>
              Runs near <span className="text-court">{location}</span>
            </>
          ) : (
            <>
              Find a run that fits your{" "}
              <span className="text-court">week.</span>
            </>
          )}
        </h1>

        <p className="mt-3 text-base text-foreground/70">
          Search by city, neighbourhood, venue or postal code.
        </p>

        {/*
          One bar holding Where and When, with Search outside it. The two
          fields are one decision -- where and when you can play -- so they
          share an enclosure, while the button is the action and stays
          separate.
        */}
        {/*
          The key remounts the form whenever the filters in the URL change.

          Where and When are uncontrolled, and defaultValue only applies when a
          field mounts -- on a client-side navigation React keeps the existing
          DOM node and a <select> holds its old selection. Without this,
          clearing the filters left When reading "Next 7 days" over a listing
          showing everything upcoming: the controls and the results disagreeing
          about what was being filtered.

          The old Reset button worked around this by assigning each control's
          value by hand. A key is the same fix stated once, and it covers every
          route to a new filter state rather than the one button.
        */}
        <form
          key={`${location}|${availability}|${sort}`}
          id={SEARCH_FORM_ID}
          action="/runs"
          className="mt-6 flex flex-wrap items-stretch gap-4"
        >
          {venue ? (
            <input type="hidden" name="venueId" value={venue.id} />
          ) : null}
          {/*
            Sort is set by its own control, which posts nothing. Without this
            the order would silently reset every time someone pressed Search.
          */}
          {sort !== "soonest" ? (
            <input type="hidden" name="sort" value={sort} />
          ) : null}

          {/*
            The bar is one white container and the controls inside it are
            bare: no border, no fill, no focus ring of their own. The shared
            FIELD classes are deliberately not used here -- they draw a bordered
            box per control, which inside an already-bordered bar read as two
            rectangles nested in a third.
          */}
          <div className="flex min-w-0 flex-[999_1_32rem] flex-wrap overflow-hidden rounded-[20px] border-2 border-foreground bg-white shadow-[0_6px_0_0_var(--foreground)]">
            <div className="flex min-h-[76px] min-w-0 flex-[3_1_280px] flex-col justify-center gap-1 px-[22px] py-3">
              <label
                htmlFor="location"
                className="text-xs font-bold uppercase tracking-[0.8px] text-[#5B5B5B]"
              >
                Where
              </label>
              <input
                id="location"
                name="location"
                type="search"
                defaultValue={location}
                autoComplete="address-level2"
                placeholder="Toronto, East York, or M9V 4L9"
                className="w-full min-w-0 border-0 bg-transparent p-0 text-[18px] text-foreground outline-none placeholder:text-placeholder focus:outline-none"
              />
            </div>

            <div className="flex min-h-[76px] min-w-0 flex-[1_1_200px] flex-col justify-center gap-1 border-l border-line px-[22px] py-3">
              <label
                htmlFor="availability"
                className="text-xs font-bold uppercase tracking-[0.8px] text-[#5B5B5B]"
              >
                When
              </label>
              {/*
                select-field without FIELD: it supplies our own chevron and
                removes the native one, which is the only part of the shared
                select styling this bar still wants.
              */}
              <select
                id="availability"
                name="availability"
                defaultValue={availability}
                className="select-field -ml-0 w-full min-w-0 border-0 bg-transparent py-0 pl-0 text-[18px] font-medium text-foreground outline-none focus:outline-none"
              >
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[80px] flex-[1_1_180px] items-center justify-center gap-[10px] rounded-[20px] border-2 border-foreground bg-court text-[17px] font-extrabold uppercase tracking-[0.6px] text-foreground shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)] active:translate-y-[6px] active:shadow-none motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Search
            <SearchChevronIcon />
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <RunSourceChips activeSourceType={sourceType} params={filterParams} />

          <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />

          <MoreFilters
            formId={SEARCH_FORM_ID}
            skillLevel={skillLevel}
            ageGroup={ageGroup}
            skillOptions={skillOptions}
            ageOptions={ageOptions}
          />

          {/*
            A link to the bare listing, which is what "no filters" actually is.
            It used to be a button that reset each control by hand; the URL
            already describes the whole filter state, so navigating to the one
            without any is both simpler and impossible to get out of sync.
          */}
          {hasFilters ? (
            <Link
              href="/runs"
              className="ml-1 text-[15px] font-semibold text-foreground underline underline-offset-[3px] hover:text-link-hover"
            >
              Clear all
            </Link>
          ) : null}
        </div>

        {venue ? (
          <div className="mt-5">
            <VenueFilterChip venueName={venue.name} params={filterParams} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-4">
          <p className="text-[17px] text-[#4A4540]">
            <span className="text-[22px] font-extrabold text-foreground">
              {totalCount.toLocaleString("en-CA")}
            </span>{" "}
            {totalCount === 1 ? "run" : "runs"} ·{" "}
            {sort === "latest" ? "latest first" : "soonest first"}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <RunsSortSelect sort={sort} params={filterParams} />

            <Link href="/runs/new" className={`${raisedButtonClass()} gap-2`}>
              <span aria-hidden="true" className="text-base leading-none">
                +
              </span>
              Add a run
            </Link>
          </div>
        </div>

        {runs.length === 0 ? (
          <div className="mt-8 rounded-[20px] border-2 border-dashed border-foreground/55 p-8 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              No runs match this search
            </h2>
            <p className="mx-auto mt-2 max-w-md text-base leading-7 text-foreground/70">
              Try a broader area, switch When to any time, or clear the filters
              to see everything that is coming up.
            </p>
            <Link
              href="/runs"
              className={`mt-5 ${raisedButtonClass({ variant: "solid" })}`}
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {dayGroups.map((group) => (
              <section key={group.key} className="space-y-4">
                {/*
                  A day heading rather than a date on every card. In a list
                  ordered by time the date repeats for every run in a day, and
                  reading it once per group is both less ink and a clearer
                  answer to "what is on tonight".
                */}
                <h2 className="text-base">
                  <span className="font-bold text-foreground">
                    {group.label}
                  </span>
                  <span className="text-foreground/60">
                    {" "}
                    · {group.dateLabel}
                  </span>
                </h2>

                <div className="space-y-7">
                  {group.items.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      isToday={group.label === "Today"}
                    />
                  ))}
                </div>
              </section>
            ))}

            <LoadMoreRuns loadMore={loadMore} params={filterParams} />
          </div>
        )}
      </section>
    </main>
  );
}
