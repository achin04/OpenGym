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

function VenueMapPreview({ address }: { address: string }) {
  return (
    <div className="relative min-h-36 overflow-hidden rounded-md border border-white/10 bg-[#111719] shadow-inner shadow-black/40 sm:min-h-44">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_46%,rgba(244,123,42,0.25),transparent_28%),linear-gradient(135deg,rgba(25,72,70,0.9),rgba(13,15,16,0.95))]" />
      <div className="absolute left-[-10%] top-[32%] h-8 w-[120%] rotate-[-12deg] border-y border-white/10 bg-white/6" />
      <div className="absolute left-[22%] top-[-10%] h-[130%] w-7 rotate-[18deg] border-x border-white/10 bg-white/5" />
      <div className="absolute left-[62%] top-[46%] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-court/18">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-court text-background shadow-lg shadow-court/35">
          <LocationPinIcon className="h-5 w-5" />
        </span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 rounded-md border border-white/10 bg-background/72 px-3 py-2 text-xs font-medium text-cream/72 backdrop-blur">
        {address}
      </div>
    </div>
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
  const userRsvp = !importedRun && appUser
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
  const sourceLabel = venueSourceLabel(
    run.sourceType,
    run.scheduleSource?.name,
  );
  const sourcePrefix = run.verified ? "Verified via" : "Listed via";
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venueAddress,
  )}`;

  return (
    <main className="min-h-screen px-5 py-8 text-cream sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
            Run Details
          </p>

          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
              {run.title}
            </h1>
            <p className="max-w-2xl text-cream/64">
              {run.description ?? "No description has been added yet."}
            </p>
          </div>
        </div>

        <div
          className={
            importedRun
              ? "grid gap-4"
              : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-court/35 bg-court/10 p-6 shadow-2xl shadow-court/5 sm:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-court-200">
                Tip-off
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-normal text-cream sm:text-5xl">
                {formatTimeRange(run.startTime, run.endTime)}
              </p>
              <p className="mt-3 text-base font-medium text-cream/62 sm:text-lg">
                {formatDateTime(run.startTime)}
              </p>
            </div>

            <div className="rounded-lg border border-line bg-ink-900/72 p-7 sm:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,2fr)] lg:items-stretch">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-semibold">Venue</h2>
                  <div className="mt-5">
                    <p className="text-[1.35rem] font-semibold leading-tight text-cream">
                      {run.venue.name}
                    </p>
                    <p className="mt-3 flex items-start gap-2 text-base leading-6 text-cream/62">
                      <LocationPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-court-200" />
                      <span>{venueAddress}</span>
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-background/62 px-3 py-1.5 text-sm font-medium text-cream/76">
                      {formatLabel(run.ageGroup)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-background/62 px-3 py-1.5 text-sm font-medium text-cream/76">
                      {formatLabel(run.skillLevel)} skill level
                    </span>
                    {importedRun ? null : (
                      <span className="rounded-full border border-white/10 bg-background/62 px-3 py-1.5 text-sm font-medium text-cream/76">
                        {formatPrice(run.price)}
                      </span>
                    )}
                    {run.verified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1.5 text-sm font-medium text-emerald-100/84">
                        <CheckIcon className="h-4 w-4" />
                        Verified
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-6 text-sm text-cream/42 lg:mt-auto">
                    {sourcePrefix} {sourceLabel}
                    {run.sourceUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={run.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-cream/64 transition hover:text-court-200 focus:outline-none focus:ring-2 focus:ring-court/35"
                        >
                          View source →
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="grid gap-3">
                  <VenueMapPreview address={venueAddress} />
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-court/55 px-4 py-2 text-sm font-semibold text-court-200 transition hover:bg-court hover:text-background focus:outline-none focus:ring-2 focus:ring-court/40"
                  >
                    Get directions
                    <ArrowUpRightIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {importedRun ? null : (
            <div className="rounded-lg border border-line bg-ink-900/78 p-6">
              <h2 className="text-2xl font-semibold">RSVP</h2>
              <p className="mt-2 text-cream/60">
                {goingCount} going
                {run.maxPlayers ? ` / ${run.maxPlayers} max` : ""}
              </p>
              <p className="mt-1 text-sm text-cream/45">
                {spotsLeft == null
                  ? "No player cap listed."
                  : spotsLeft === 0
                    ? "This run is full."
                    : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left.`}
              </p>

              {!clerkUser ? (
                <p className="mt-5 rounded-md border border-line bg-background/70 p-4 text-sm text-cream/68">
                  Sign in to RSVP to this run.
                </p>
              ) : isGoing ? (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-court-200">
                    You are going to this run.
                  </p>
                  <form action={cancelRsvpAction} className="mt-4">
                    <button
                      type="submit"
                      className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-background transition hover:bg-rose-300"
                    >
                      Cancel RSVP
                    </button>
                  </form>
                </div>
              ) : isFull ? (
                <p className="mt-5 text-sm text-cream/68">This run is full.</p>
              ) : (
                <form action={rsvpToThisRun} className="mt-5">
                  <button
                    type="submit"
                    className="w-full rounded-md bg-court px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-court-200"
                  >
                    RSVP
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-cream/35">Run ID: {run.id}</p>
      </section>
    </main>
  );
}
