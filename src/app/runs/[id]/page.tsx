import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { RsvpStatus, RunSourceType } from "@/generated/prisma/enums";
import {
  formatFullDate,
  formatLabel,
  formatPrice,
  formatRunLength,
  formatTimeRange,
  splitClockTime,
} from "@/lib/formatters";
import { googleDirectionsUrl } from "@/lib/geocoding/venue-geo-query";
import { upcomingRunFilter } from "@/lib/runs/public-runs";
import { sourceStatusNotice } from "@/lib/runs/source-status";
import { prisma } from "@/server/db";
import { ShareRunButton } from "./_components/share-run-button";
import { cancelRsvp, rsvpToRun } from "./actions";

type RunDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type IconProps = {
  className?: string;
};

function venueSourceLabel(sourceType: RunSourceType, sourceName?: string | null) {
  if (sourceType === RunSourceType.CITY) {
    return "City of Toronto";
  }

  return sourceName ?? formatLabel(sourceType);
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m15 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function LocationPinIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ArrowUpRightIcon({ className, strokeWidth = 2.6 }: IconProps & { strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </svg>
  );
}

/* A seal with a check: "issued by an authority", not "task done". */
function BadgeCheckIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 2.5l2.3 1.9 3-.2.6 2.9 2.4 1.8-1.3 2.7 1.3 2.7-2.4 1.8-.6 2.9-3-.2-2.3 1.9-2.3-1.9-3 .2-.6-2.9L3.7 14.3 5 11.6 3.7 8.9l2.4-1.8.6-2.9 3 .2L12 2.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="m8.8 11.9 2.2 2.2 4.2-4.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

function PersonIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function TrendingUpIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m3 17 6-6 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M15 7h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function CoinIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v9M14.5 9.8a2.6 2.6 0 0 0-5 .9c0 2.6 5 1.2 5 3.6a2.6 2.6 0 0 1-5 .6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

/** One fact in the "Good to know" row. Info, not a control, so no border. */
function InfoTag({ icon: Icon, children }: { icon: (props: IconProps) => React.ReactElement; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-[10px] bg-[#F0ECE6] px-[14px] py-[9px] text-[15px] font-semibold text-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </li>
  );
}

/** One cell of the Tip-off / Ends / Run length strip. */
function StatCell({
  label,
  value,
  unit,
  first = false,
}: {
  label: string;
  value: string;
  unit: string;
  first?: boolean;
}) {
  return (
    <div
      className={`flex flex-[1_1_150px] flex-col gap-1 px-5 py-4 ${
        first ? "pl-0" : "border-l border-[#D9D2C8]"
      }`}
    >
      <dt className="text-[15px] text-[#5B5B5B]">{label}</dt>
      <dd className="m-0 text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
        {value} <span className="text-[20px] font-bold">{unit}</span>
      </dd>
    </div>
  );
}

function VenueMapPreview({
  address,
  mapQuery,
}: {
  address: string;
  mapQuery: string;
}) {
  const apiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY;
  const embedUrl =
    apiKey && mapQuery
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
          apiKey,
        )}&q=${encodeURIComponent(mapQuery)}`
      : null;

  return (
    /*
      flex-1 with a floor, not a fixed height. The map fills whatever the left
      column leaves beside it, so the card is never taller than its own
      content; the 220px floor is what it falls back to once the right column
      wraps underneath on a narrow screen.
    */
    <div className="relative min-h-[220px] flex-[1_1_auto] overflow-hidden rounded-[16px] border-2 border-foreground bg-[#E8EAED]">
      {/* Stays behind the iframe so the lazy embed fades in over map art instead of an empty box. */}
      <VenueMapArt address={address} showAddress={!embedUrl} />
      {embedUrl ? (
        <iframe
          title={`Map showing ${address}`}
          src={embedUrl}
          loading="lazy"
          allowFullScreen
          // The API key is referrer-restricted, so Google rejects requests with no referrer.
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : null}
    </div>
  );
}

function VenueMapArt({
  address,
  showAddress,
}: {
  address: string;
  showAddress: boolean;
}) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,20,20,0.07)_1px,transparent_1px),linear-gradient(0deg,rgba(20,20,20,0.07)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_46%,rgba(238,123,58,0.22),transparent_28%),linear-gradient(135deg,rgba(246,244,241,0.95),rgba(251,250,248,0.95))]" />
      <div className="absolute left-[-10%] top-[32%] h-8 w-[120%] rotate-[-12deg] border-y border-foreground/10 bg-foreground/6" />
      <div className="absolute left-[22%] top-[-10%] h-[130%] w-7 rotate-[18deg] border-x border-foreground/10 bg-foreground/5" />
      <div className="absolute left-[62%] top-[46%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-court/18">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-court text-foreground shadow-lg shadow-court/35">
          <LocationPinIcon className="h-5 w-5" />
        </span>
      </div>
      {showAddress ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-[8px] border-2 border-foreground bg-white/85 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur">
          {address}
        </div>
      ) : null}
    </>
  );
}

export default async function RunDetailsPage({ params }: RunDetailsPageProps) {
  const { id } = await params;

  const clerkUser = await currentUser();

  const appUser = clerkUser
    ? await prisma.user.findUnique({
        where: { clerkUserId: clerkUser.id },
        select: { id: true },
      })
    : null;

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      venue: true,
      scheduleSource: true,
      createdByUser: { select: { name: true } },
      rsvps: {
        where: { status: RsvpStatus.GOING },
        select: { id: true },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const importedRun = run.sourceType !== RunSourceType.USER;
  const isCityRun = run.sourceType === RunSourceType.CITY;
  const sourceLabel = venueSourceLabel(run.sourceType, run.scheduleSource?.name);
  // A delisted run keeps its page so shared links and search results do not
  // break, but it must say the source no longer lists it and must not offer an
  // RSVP. Imported runs never have RSVPs in the first place.
  const sourceNotice = sourceStatusNotice(run.sourceStatus, sourceLabel);
  const showRsvp = !importedRun && !sourceNotice;
  const userRsvp = showRsvp && appUser
    ? await prisma.rsvp.findUnique({
        where: { userId_runId: { userId: appUser.id, runId: run.id } },
        select: { status: true },
      })
    : null;

  // Up to three other upcoming runs at the same venue, through the same
  // predicate the listing and the map use so the three views cannot disagree
  // about what counts as upcoming.
  const moreAtVenue = await prisma.run.findMany({
    where: {
      ...upcomingRunFilter(new Date()),
      venueId: run.venueId,
      id: { not: run.id },
    },
    orderBy: { startTime: "asc" },
    take: 3,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      ageGroup: true,
      skillLevel: true,
    },
  });

  const goingCount = run.rsvps.length;
  const isGoing = userRsvp?.status === RsvpStatus.GOING;
  const isFull = run.maxPlayers != null && goingCount >= run.maxPlayers;
  const rsvpToThisRun = rsvpToRun.bind(null, run.id);
  const cancelRsvpAction = cancelRsvp.bind(null, run.id);
  const spotsLeft =
    run.maxPlayers == null ? null : Math.max(run.maxPlayers - goingCount, 0);

  const venueAddress = [run.venue.addressLine1, run.venue.addressLine2, run.venue.city]
    .filter(Boolean)
    .join(", ");
  const geoParts = {
    addressLine1: run.venue.addressLine1,
    city: run.venue.city,
    postalCode: run.venue.postalCode,
  };
  const directionsUrl = googleDirectionsUrl(geoParts);
  const mapQuery = [run.venue.addressLine1, run.venue.city, run.venue.postalCode, "ON, Canada"]
    .filter(Boolean)
    .join(", ");

  const start = splitClockTime(run.startTime);
  const end = splitClockTime(run.endTime);
  const length = formatRunLength(run.startTime, run.endTime);

  const hostName = isCityRun
    ? "the City of Toronto"
    : importedRun
      ? sourceLabel
      : (run.createdByUser?.name ?? "a player");
  const priceLabel = formatPrice(run.price);

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-6 pb-20 pt-10 text-foreground">
      <Link
        href="/runs"
        className="inline-flex min-h-11 items-center gap-2 self-start text-[15px] font-semibold text-foreground no-underline"
      >
        <ChevronLeftIcon className="h-[18px] w-[18px]" />
        All runs
      </Link>

      {sourceNotice ? (
        <div
          role="status"
          className="rounded-[16px] border-2 border-foreground bg-surface p-5 shadow-[0_4px_0_0_var(--foreground)]"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-court">
            {sourceNotice.heading}
          </p>
          <p className="mt-2 text-[15px] leading-6 text-[#4A4540]">{sourceNotice.body}</p>
        </div>
      ) : null}

      <article
        aria-labelledby="run-venue-heading"
        className="overflow-hidden rounded-[24px] border-2 border-foreground bg-white shadow-[0_6px_0_0_var(--foreground)]"
      >
        {/*
          The host bar. A municipal program and someone's pickup game are told
          apart before a word is read, which is the whole reason provenance
          gets its own band rather than a chip somewhere in the body.
        */}
        <div
          className={`flex flex-wrap items-center justify-between gap-[10px] px-8 py-[14px] ${
            isCityRun
              ? "border-b border-[#C9D9E8] bg-[#E8F0F7]"
              : "border-b border-line bg-[#F6F4F1]"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {isCityRun ? (
              /*
                The city's own mark, not a drawing standing in for it -- the
                same asset and the same white tile as the run cards, so the
                listing and the detail page read as one host.

                The tile stays white because the asset's background is opaque
                white: on the strip's blue tint it would show as a pale square.

                Empty alt on purpose -- the sentence beside it already names
                the host, and "City of Toronto logo, Hosted by the City of
                Toronto" says it twice to a screen reader.
              */
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-[#1B4A78] bg-white">
                <Image
                  src="/CityOfTorontoLogo.webp"
                  alt=""
                  width={64}
                  height={64}
                  className="h-[26px] w-[26px] object-contain"
                />
              </span>
            ) : (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {hostName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?"}
              </span>
            )}

            <p
              className={`min-w-0 truncate text-[15px] font-bold ${
                isCityRun ? "text-[#1B4A78]" : "text-foreground"
              }`}
            >
              Hosted by {hostName}
            </p>
          </div>

          {isCityRun ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1B4A78] py-[5px] pl-2 pr-3 text-[13px] font-semibold text-white">
              <BadgeCheckIcon className="h-4 w-4" />
              Official city program
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-10 p-8">
          <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h1
                id="run-venue-heading"
                className="m-0 text-[clamp(22px,2.4vw,28px)] font-bold leading-[1.25] tracking-[-0.02em]"
              >
                {run.venue.name}
              </h1>

              <p className="flex items-center gap-2 text-[16px] text-[#5B5B5B]">
                <LocationPinIcon className="h-[18px] w-[18px] shrink-0 text-[#B4501A]" />
                {run.venue.addressLine1}, {run.venue.city}
              </p>
            </div>

            <div className="flex flex-col gap-[14px]">
              <p className="m-0 text-[18px] font-bold">{formatFullDate(run.startTime)}</p>

              <dl className="m-0 flex flex-wrap border-y-2 border-foreground">
                <StatCell first label="Tip-off" value={start.time} unit={start.unit} />
                <StatCell label="Ends" value={end.time} unit={end.unit} />
                <StatCell label="Run length" value={length.value} unit={length.unit} />
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="m-0 text-[13px] font-bold uppercase tracking-[1.2px] text-[#5B5B5B]">
                Good to know
              </h2>

              <ul className="m-0 flex list-none flex-wrap gap-[10px] p-0">
                <InfoTag icon={PersonIcon}>{formatLabel(run.ageGroup)}</InfoTag>
                <InfoTag icon={TrendingUpIcon}>
                  {formatLabel(run.skillLevel)} skill level
                </InfoTag>
                <InfoTag icon={ArrowRightIcon}>Drop-in</InfoTag>
                {/*
                  Not in the design, which shows a free city program. Added
                  conditionally so a community run that charges does not lose
                  its price entirely -- it appears only when there is something
                  to say.
                */}
                {priceLabel !== "Free" ? (
                  <InfoTag icon={CoinIcon}>{priceLabel}</InfoTag>
                ) : null}
              </ul>
            </div>

            {showRsvp ? (
              <div className="rounded-[16px] border-2 border-foreground bg-surface p-6">
                <h2 className="text-2xl font-semibold">RSVP</h2>
                <p className="mt-2 text-base font-semibold text-foreground/75">
                  {goingCount} going{run.maxPlayers ? ` / ${run.maxPlayers} max` : ""}
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {spotsLeft == null
                    ? "No player cap listed."
                    : spotsLeft === 0
                      ? "This run is full."
                      : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left.`}
                </p>

                {!clerkUser ? (
                  <p className="mt-5 rounded-[10px] border-2 border-foreground bg-white p-4 text-sm text-foreground/75">
                    Sign in to RSVP to this run.
                  </p>
                ) : isGoing ? (
                  <form action={cancelRsvpAction} className="mt-4">
                    <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-2 border-foreground bg-white px-4 text-sm font-semibold shadow-[0_4px_0_0_var(--foreground)]">
                      Cancel RSVP
                    </button>
                  </form>
                ) : (
                  <form action={rsvpToThisRun} className="mt-5">
                    <button
                      type="submit"
                      disabled={isFull}
                      className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-2 border-foreground bg-court px-4 text-sm font-semibold shadow-[0_4px_0_0_var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isFull ? "Run is full" : "RSVP"}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
          </div>

          {/*
            The map takes the height the left column sets rather than a fixed
            one: flex-1 inside a stretched column. A fixed height would either
            leave a gap beside a long venue name or push the card taller than
            its own content.
          */}
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-[14px]">
            <VenueMapPreview address={venueAddress} mapQuery={mapQuery} />

            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-14 items-center justify-center gap-[10px] rounded-[14px] border-2 border-foreground bg-court text-[17px] font-extrabold text-foreground no-underline shadow-[0_4px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] active:translate-y-[4px] active:shadow-none motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Get directions
              <ArrowUpRightIcon className="h-[18px] w-[18px]" />
            </a>

            <div className="mt-1">
              <ShareRunButton title={`${run.venue.name} - ${formatFullDate(run.startTime)}`} />
            </div>
          </div>
        </div>

        {run.sourceUrl || importedRun ? (
          <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-line bg-[#FBFAF8] px-8 py-[18px]">
            <p className="m-0 text-[15px] text-[#5B5B5B]">
              Schedule from {sourceLabel}. Times can change, so check before you head out.
            </p>

            {run.sourceUrl ? (
              <a
                href={run.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-foreground underline underline-offset-[3px]"
              >
                View on {isCityRun ? "toronto.ca" : "the source"}
                <ArrowUpRightIcon className="h-4 w-4" strokeWidth={2} />
              </a>
            ) : null}
          </div>
        ) : null}
      </article>

      {moreAtVenue.length > 0 ? (
        <section className="mt-4 flex flex-col gap-4">
          <h2 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">
            More runs at this venue
          </h2>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {moreAtVenue.map((other) => {
              const weekday = new Intl.DateTimeFormat("en-CA", {
                weekday: "short",
                timeZone: "America/Toronto",
              }).format(other.startTime);
              const day = new Intl.DateTimeFormat("en-CA", {
                day: "numeric",
                timeZone: "America/Toronto",
              }).format(other.startTime);

              return (
                <Link
                  key={other.id}
                  href={`/runs/${other.id}`}
                  className="flex items-center gap-4 rounded-[16px] border-2 border-foreground bg-white p-4 no-underline shadow-[0_4px_0_0_var(--foreground)]"
                >
                  <span className="flex w-[60px] shrink-0 flex-col items-center rounded-[10px] border-2 border-foreground py-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[1px] text-[#5B5B5B]">
                      {weekday}
                    </span>
                    <span className="text-[22px] font-extrabold">{day}</span>
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[16px] font-bold">
                      {formatTimeRange(other.startTime, other.endTime)}
                    </span>
                    <span className="text-[14px] text-[#5B5B5B]">
                      {formatLabel(other.ageGroup)} &middot; {formatLabel(other.skillLevel)}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
