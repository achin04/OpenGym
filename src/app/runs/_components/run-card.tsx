import Image from "next/image";
import Link from "next/link";
import { RunSourceType } from "@/generated/prisma/enums";
import { formatDuration, formatLabel, formatTimeRange } from "@/lib/formatters";
import { googleDirectionsUrl } from "@/lib/geocoding/venue-geo-query";

/**
 * One run in the listing.
 *
 * The card is split into a host strip and a body, which is the change that
 * matters: who is running a session is the first thing someone needs, because
 * it decides whether the listing is a municipal program with a published
 * schedule or a game somebody organised. Previously that lived in a small mark
 * in the corner, read last if at all.
 *
 * Everything else in the body is the same four facts for every card -- time,
 * address, age -- in the same order, so a long list scans down a column rather
 * than being re-read per row. Level and price are deliberately not here: they
 * are empty or identical on nearly every imported run, and a field that is
 * usually blank teaches people to skip the whole region.
 */
export type RunCardRun = {
  id: string;
  sourceType: RunSourceType;
  startTime: Date;
  endTime: Date;
  ageGroup: string;
  venue: {
    name: string;
    addressLine1: string;
    city: string;
    postalCode: string | null;
  };
  createdByUser: { name: string | null } | null;
};

type HostPresentation = {
  official: boolean;
  name: string;
  /** A qualifier after the host's name, where the name alone is not enough. */
  kind: string | null;
  badge: string | null;
  /** A real mark for the host, used in place of a generic icon. */
  logoSrc: string | null;
};

function hostPresentation(run: RunCardRun): HostPresentation {
  if (run.sourceType === RunSourceType.CITY) {
    return {
      official: true,
      name: "the City of Toronto",
      // No qualifier: the pill at the other end of this strip already says
      // "Official city program", so "Parks & Recreation drop-in" was a second
      // way of saying the same thing on one line.
      kind: null,
      badge: "Official city program",
      logoSrc: "/CityOfTorontoLogo.webp",
    };
  }

  if (run.sourceType === RunSourceType.UNIVERSITY) {
    return {
      official: true,
      name: "University program",
      kind: "Campus drop-in",
      badge: "Official program",
      logoSrc: null,
    };
  }

  return {
    official: false,
    // A run can outlive the account that created it -- createdByUserId is
    // SetNull on delete -- so the listing has to render without an organiser.
    name: run.createdByUser?.name ?? "A player",
    // Kept here, unlike the city's: a community run has no pill, so this line
    // is the only thing saying it is not an official program.
    kind: "Community run",
    badge: null,
    logoSrc: null,
  };
}

/** Up to two initials, for the community host's avatar. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (letters || "?").toUpperCase();
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5.5 20a6.5 6.5 0 0 1 13 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M5 20V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14M14 20V10h4a1 1 0 0 1 1 1v9M3 20h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 9h3M8 13h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * A scalloped seal with a check inside, rather than a circle with a tick.
 *
 * The shape is doing the work here: a seal reads as "issued by an authority",
 * which is the claim the pill makes, while a circle-check reads as "done" --
 * the same mark a completed task gets.
 */
function BadgeCheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 2.5l2.3 1.9 3-.2.6 2.9 2.4 1.8-1.3 2.7 1.3 2.7-2.4 1.8-.6 2.9-3-.2-2.3 1.9-2.3-1.9-3 .2-.6-2.9L3.7 14.3 5 11.6 3.7 8.9l2.4-1.8.6-2.9 3 .2L12 2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="m8.8 11.9 2.2 2.2 4.2-4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
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

/**
 * #B4501A rather than the --court orange the buttons use.
 *
 * These icons sit directly beside body text at 18px. The bright accent at that
 * size against cream is thin enough to shimmer, and it also competes with the
 * View run button, which is the one thing on the card that should read as
 * orange. The darker burnt tone keeps the family without the noise.
 */
function MetaItem({
  icon: Icon,
  children,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon className="h-[18px] w-[18px] shrink-0 text-[#B4501A]" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function RunCard({
  run,
  isToday = false,
}: {
  run: RunCardRun;
  /**
   * Tints the date block. Passed down rather than derived here: the listing
   * has already worked out which Toronto day each group is, and recomputing it
   * per card would mean every card doing its own timezone arithmetic and
   * risking a different answer from its own heading.
   */
  isToday?: boolean;
}) {
  const host = hostPresentation(run);
  const directions = googleDirectionsUrl({
    addressLine1: run.venue.addressLine1,
    city: run.venue.city,
    postalCode: run.venue.postalCode,
  });

  const weekday = new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    timeZone: "America/Toronto",
  }).format(run.startTime);
  const day = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    timeZone: "America/Toronto",
  }).format(run.startTime);
  const month = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    timeZone: "America/Toronto",
  }).format(run.startTime);

  return (
    <article className="overflow-hidden rounded-[20px] border-2 border-foreground bg-white shadow-[0_6px_0_0_var(--foreground)]">
      {/*
        The host strip. Blue tint for a municipal program, cream for a
        community run -- the two are told apart before a single word is read,
        which is the point of giving provenance its own band.
      */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-2 px-4 py-3 ${
          host.official
            ? "border-city/20 bg-city-tint"
            : "border-line bg-background"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {host.logoSrc ? (
            /*
              The host's own mark, not a stand-in for it. The tile stays white
              because the asset's background is opaque white -- see the note in
              the source-chip history -- so it needs a white field to sit on
              rather than the strip's blue tint.

              Empty alt on purpose: the sentence beside it already names the
              host, and a screen reader announcing "City of Toronto logo,
              Hosted by the City of Toronto" says it twice.
            */
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-[#1B4A78] bg-white">
              <Image
                src={host.logoSrc}
                alt=""
                width={64}
                height={64}
                className="h-[26px] w-[26px] object-contain"
              />
            </span>
          ) : host.official ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-[#1B4A78] bg-white text-[#1B4A78]">
              <BuildingIcon className="h-[22px] w-[22px]" />
            </span>
          ) : (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
              {initials(host.name)}
            </span>
          )}

          <p className="min-w-0 truncate text-[15px]">
            <span
              className={`font-semibold ${host.official ? "text-[#1B4A78]" : "text-foreground"}`}
            >
              Hosted by {host.name}
            </span>
            {host.kind ? (
              <span className="text-[#5B5B5B]"> {host.kind}</span>
            ) : null}
          </p>
        </div>

        {host.badge ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-city px-3 py-1 text-[13px] font-semibold text-white">
            <BadgeCheckIcon className="h-4 w-4" />
            {host.badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-5 p-4 sm:p-5">
        {/*
          Today's runs take a warm fill, later ones stay white. In a list that
          opens on today, that is the fastest possible answer to "is this one
          tonight" -- no reading required.
        */}
        <div
          className={`w-[104px] shrink-0 rounded-[14px] border-2 border-foreground py-3 text-center ${
            isToday ? "bg-[#FBE3D3]" : "bg-white"
          }`}
        >
          <p
            className={`text-[13px] font-bold uppercase tracking-[1.2px] ${
              isToday ? "text-[#5A3A26]" : "text-[#5B5B5B]"
            }`}
          >
            {weekday}
          </p>
          <p className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] text-foreground">
            {day}
          </p>
          <p
            className={`text-[13px] font-bold uppercase tracking-[1.2px] ${
              isToday ? "text-[#5A3A26]" : "text-[#5B5B5B]"
            }`}
          >
            {month}
          </p>
        </div>

        <div className="flex min-w-[16rem] flex-[3_1_20rem] flex-col gap-3">
          {/*
            The venue is the heading, and the run's own title is not shown.

            Every imported run is called "Basketball", so a column of identical
            headings told nobody anything while the one fact that distinguishes
            two runs at the same hour -- which gym -- sat underneath in grey.

            It wraps rather than truncating. It is now the line that identifies
            the card, and venue names here run long enough ("Ethennonnhawahstihnen'
            Community Recreation Centre and Library") that clipping would cut off
            the part that tells them apart.
          */}
          <h3 className="text-[24px] font-bold leading-[1.2] tracking-[-0.02em] text-foreground">
            <Link href={`/runs/${run.id}`} className="hover:text-link-hover">
              {run.venue.name}
            </Link>
          </h3>

          {/*
            One row of facts, wrapping on a narrow card. The icons carry
            nothing a screen reader needs -- the text says it all -- so they
            are aria-hidden and this stays plain text.
          */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5 text-[16px] font-semibold text-foreground">
            <MetaItem icon={ClockIcon}>
              {formatTimeRange(run.startTime, run.endTime)}
              <span className="font-normal text-[#5B5B5B]">
                {" "}
                · {formatDuration(run.startTime, run.endTime)}
              </span>
            </MetaItem>

            <MetaItem icon={PinIcon}>
              {run.venue.addressLine1}, {run.venue.city}
            </MetaItem>

            <MetaItem icon={PersonIcon}>{formatLabel(run.ageGroup)}</MetaItem>
          </div>
        </div>

        <div className="flex max-w-[220px] flex-[1_1_180px] flex-col items-stretch gap-2.5">
          <Link
            href={`/runs/${run.id}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-2 border-foreground bg-court text-[16px] font-extrabold text-foreground shadow-[0_4px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] active:translate-y-[4px] active:shadow-none motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            View run
            <ChevronRightIcon className="h-4 w-4" />
          </Link>

          {/*
            An external link to Google Maps, so it opens in a new tab rather
            than taking someone out of a listing they are part-way through.
          */}
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-foreground underline underline-offset-[3px] hover:text-link-hover"
          >
            Get directions
          </a>
        </div>
      </div>
    </article>
  );
}
