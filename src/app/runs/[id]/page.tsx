import { raisedButtonClass } from "@/app/_components/raised-button";
import { prisma } from "@/server/db";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  formatLabel,
  formatPrice,
  formatTimeRange,
} from "@/lib/formatters";
import { currentUser } from "@clerk/nextjs/server";
import { RsvpStatus, RunSourceType } from "@/generated/prisma/enums";
import { sourceStatusNotice } from "@/lib/runs/source-status";
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

function LocationPinIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m3.5 8.2 2.7 2.7 6.3-6.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M5 4h7v7M12 4 4 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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
    <div className="relative min-h-36 overflow-hidden rounded-[10px] border-2 border-foreground bg-surface sm:min-h-44">
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
        where: {
          clerkUserId: clerkUser.id,
        },
        select: {
          id: true,
        },
      })
    : null;

  const run = await prisma.run.findUnique({
    where: {
      id,
    },
    include: {
      venue: true,
      scheduleSource: true,
      rsvps: {
        where: {
          status: RsvpStatus.GOING,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  const importedRun = run.sourceType !== RunSourceType.USER;
  const sourceLabel = venueSourceLabel(
    run.sourceType,
    run.scheduleSource?.name,
  );
  // A delisted run keeps its page so shared links and search results do not
  // break, but it must say the source no longer lists it and must not offer an
  // RSVP. Imported runs never have RSVPs in the first place.
  const sourceNotice = sourceStatusNotice(run.sourceStatus, sourceLabel);
  const showRsvp = !importedRun && !sourceNotice;
  const userRsvp = showRsvp && appUser
    ? await prisma.rsvp.findUnique({
        where: {
          userId_runId: {
            userId: appUser.id,
            runId: run.id,
          },
        },
        select: {
          status: true,
        },
      })
    : null;

  const goingCount = run.rsvps.length;
  const isGoing = userRsvp?.status === RsvpStatus.GOING;
  const isFull = run.maxPlayers != null && goingCount >= run.maxPlayers;
  const rsvpToThisRun = rsvpToRun.bind(null, run.id);
  const cancelRsvpAction = cancelRsvp.bind(null, run.id);
  const spotsLeft =
    run.maxPlayers == null ? null : Math.max(run.maxPlayers - goingCount, 0);
  const venueAddress = [
    run.venue.addressLine1,
    run.venue.addressLine2,
    run.venue.city,
  ]
    .filter(Boolean)
    .join(", ");
  // Geocoding query omits addressLine2 (unit/suite numbers degrade matching) and
  // pins the region, since Venue has no province/country column and runs are Toronto-only.
  const venueGeoQuery = [
    run.venue.addressLine1,
    run.venue.city,
    run.venue.postalCode,
    "ON, Canada",
  ]
    .filter(Boolean)
    .join(", ");
  const sourcePrefix = run.verified ? "Verified via" : "Listed via";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venueGeoQuery,
  )}`;

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-4">
          {/*
            The run title is no longer shown: for imported runs it is a generic
            label ("Basketball") that the Tip-off and Venue panels below say
            better. It stays in the document as a visually hidden h1 so the
            page still has one heading at the top level, which assistive
            technology and search engines both rely on.
          */}
          <h1 className="sr-only">{run.title}</h1>

          {sourceNotice ? (
            <div
              role="status"
              className="max-w-3xl rounded-[16px] border-2 border-foreground bg-surface p-5 shadow-[0_4px_0_0_var(--foreground)]"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-court">
                {sourceNotice.heading}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/75">
                {sourceNotice.body}
              </p>
            </div>
          ) : null}
        </div>

        <div
          className={
            showRsvp
              ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"
              : "grid gap-4"
          }
        >
          <div className="space-y-4">
            <div className="rounded-[20px] border-2 border-foreground bg-court/15 p-6 shadow-[0_6px_0_0_var(--foreground)] sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-court">
                Tip-off
              </p>
              <p className="mt-3 text-[clamp(30px,3.4vw,48px)] font-bold leading-[1.04] tracking-[-0.03em] text-foreground">
                {formatTimeRange(run.startTime, run.endTime)}
              </p>
              <p className="mt-3 text-base font-semibold text-foreground/70 sm:text-lg">
                {formatDateTime(run.startTime)}
              </p>
            </div>

            <div className="rounded-[20px] border-2 border-foreground bg-surface p-7 shadow-[0_6px_0_0_var(--foreground)] sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)] lg:items-stretch">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-semibold">Venue</h2>
                  <div className="mt-5">
                    <p className="text-[1.35rem] font-semibold leading-tight text-foreground">
                      {run.venue.name}
                    </p>
                    <p className="mt-3 flex items-start gap-2 text-base leading-6 text-foreground/62">
                      <LocationPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-court" />
                      <span>{venueAddress}</span>
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border-2 border-foreground bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
                      {formatLabel(run.ageGroup)}
                    </span>
                    <span className="rounded-full border-2 border-foreground bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
                      {formatLabel(run.skillLevel)} skill level
                    </span>
                    {importedRun ? null : (
                      <span className="rounded-full border-2 border-foreground bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
                        {formatPrice(run.price)}
                      </span>
                    )}
                    {run.verified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground bg-court px-3 py-1.5 text-sm font-semibold text-foreground">
                        <CheckIcon className="h-4 w-4" />
                        Verified
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-6 text-sm text-foreground/60 lg:mt-auto">
                    {sourcePrefix} {sourceLabel}
                    {run.sourceUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={run.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-foreground underline underline-offset-2 transition hover:text-link-hover focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        >
                          View source →
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="grid gap-3">
                  <VenueMapPreview
                    address={venueAddress}
                    mapQuery={venueGeoQuery}
                  />
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`gap-2 ${raisedButtonClass()}`}
                  >
                    Get directions
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {showRsvp ? (
            <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]">
              <h2 className="text-2xl font-semibold">RSVP</h2>
              <p className="mt-2 text-base font-semibold text-foreground/75">
                {goingCount} going
                {run.maxPlayers ? ` / ${run.maxPlayers} max` : ""}
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
                <div className="mt-5">
                  <p className="text-sm font-semibold text-court">
                    You are going to this run.
                  </p>
                  <form action={cancelRsvpAction} className="mt-4">
                    <button
                      type="submit"
                      className={raisedButtonClass()}
                    >
                      Cancel RSVP
                    </button>
                  </form>
                </div>
              ) : isFull ? (
                <p className="mt-5 text-sm text-foreground/75">This run is full.</p>
              ) : (
                <form action={rsvpToThisRun} className="mt-5">
                  <button
                    type="submit"
                    className={`w-full ${raisedButtonClass({ variant: "solid" })}`}
                  >
                    RSVP
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
