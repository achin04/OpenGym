import { prisma } from "@/server/db";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  formatLabel,
  formatPrice,
  formatTimeRange,
} from "@/lib/formatters";
import { currentUser } from "@clerk/nextjs/server";
import { RsvpStatus } from "@/generated/prisma/enums";
import { cancelRsvp, rsvpToRun } from "./actions";

type RunDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

  const userRsvp = appUser
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

  return (
    <main className="min-h-screen px-5 py-8 text-cream sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
            Run Details
          </p>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal sm:text-5xl">
                {run.title}
              </h1>
              <p className="max-w-2xl text-cream/64">
                {run.description ?? "No description has been added yet."}
              </p>
            </div>

            <div className="rounded-lg border border-court/30 bg-court/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-court-200">
                Tip-off
              </p>
              <p className="mt-2 text-2xl font-semibold text-cream">
                {formatTimeRange(run.startTime, run.endTime)}
              </p>
              <p className="mt-1 text-sm text-cream/55">
                {formatDateTime(run.startTime)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-lg border border-line bg-ink-900/72 p-6">
            <h2 className="text-2xl font-semibold">Venue</h2>

            <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-cream/38">Name</dt>
                <dd className="mt-1 font-medium text-cream">
                  {run.venue.name}
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
                <dt className="text-cream/38">Price</dt>
                <dd className="mt-1 font-medium text-cream">
                  {formatPrice(run.price)}
                </dd>
              </div>

              <div>
                <dt className="text-cream/38">Skill level</dt>
                <dd className="mt-1 font-medium text-cream">
                  {formatLabel(run.skillLevel)}
                </dd>
              </div>

              <div>
                <dt className="text-cream/38">Age group</dt>
                <dd className="mt-1 font-medium text-cream">
                  {formatLabel(run.ageGroup)}
                </dd>
              </div>

              <div>
                <dt className="text-cream/38">Source</dt>
                <dd className="mt-1 font-medium text-cream">
                  {formatLabel(run.sourceType)}
                </dd>
              </div>

              <div>
                <dt className="text-cream/38">Status</dt>
                <dd className="mt-1 font-medium text-cream">
                  {run.verified ? "Verified" : "Community listed"}
                </dd>
              </div>
            </dl>

            {run.sourceUrl ? (
              <a
                href={run.sourceUrl}
                className="mt-6 inline-flex rounded-md border border-line px-4 py-2 text-sm font-semibold text-cream/72 transition hover:border-court/50 hover:text-cream"
              >
                View source
              </a>
            ) : null}
          </div>

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
        </div>

        <p className="text-xs text-cream/35">Run ID: {run.id}</p>
      </section>
    </main>
  );
}
