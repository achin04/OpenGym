import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { GeocodeSource } from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import { geocodeVenueAddress, type GeocodeOptions } from "./nominatim";

type VenueCoordinatesPrisma = Pick<PrismaClient, "venue">;

/**
 * What a geocode attempt is allowed to overwrite.
 *
 * Three named modes rather than a pair of booleans, because the combinations
 * that two booleans allow are mostly meaningless and the one that matters --
 * "refresh what the geocoder produced but never touch what a human fixed" --
 * is the whole reason Venue.geocodeSource exists.
 *
 * - fillMissing:  only venues with no coordinates at all. The safe default,
 *                 used by venue creation and by the backfill script, so both
 *                 are idempotent and re-runnable.
 * - refreshAuto:  also re-geocodes rows whose coordinates came from Nominatim,
 *                 leaving MANUAL rows untouched. For a future provider change.
 * - force:        overwrites everything, including manual corrections. Only for
 *                 an operator who has explicitly asked for exactly that.
 */
export type GeocodeMode = "fillMissing" | "refreshAuto" | "force";

export type GeocodeVenueResult =
  | { status: "ok"; latitude: number; longitude: number }
  | { status: "skipped"; reason: string }
  | { status: "no_match"; reason: string }
  | { status: "error"; reason: string };

export type GeocodeVenueOptions = {
  db?: VenueCoordinatesPrisma;
  mode?: GeocodeMode;
  geocode?: GeocodeOptions;
};

function mayOverwrite(
  mode: GeocodeMode,
  venue: { latitude: number | null; geocodeSource: GeocodeSource | null },
): { allowed: true } | { allowed: false; reason: string } {
  const hasCoordinates = venue.latitude !== null;

  if (!hasCoordinates) {
    return { allowed: true };
  }

  if (mode === "force") {
    return { allowed: true };
  }

  if (mode === "fillMissing") {
    return { allowed: false, reason: "Venue already has coordinates." };
  }

  if (venue.geocodeSource === GeocodeSource.MANUAL) {
    return {
      allowed: false,
      reason: "Coordinates were set manually and were left unchanged.",
    };
  }

  return { allowed: true };
}

/**
 * Geocodes one venue and stores the result.
 *
 * Deliberately not wrapped in a transaction and never called from inside one:
 * the HTTP request would hold a pooled connection open for the provider's
 * latency, and an HTTP call cannot be rolled back, so a retry would spend
 * Nominatim's rate-limit budget twice. The write here is a single row update,
 * which is atomic on its own.
 *
 * Never throws. Geocoding is enrichment, and a venue must survive its failure.
 */
export async function geocodeVenueById(
  venueId: string,
  options: GeocodeVenueOptions = {},
): Promise<GeocodeVenueResult> {
  const db = options.db ?? defaultPrisma;
  const mode = options.mode ?? "fillMissing";

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: {
      id: true,
      addressLine1: true,
      city: true,
      postalCode: true,
      latitude: true,
      geocodeSource: true,
    },
  });

  if (!venue) {
    return { status: "error", reason: "Venue was not found." };
  }

  const overwrite = mayOverwrite(mode, venue);

  if (!overwrite.allowed) {
    return { status: "skipped", reason: overwrite.reason };
  }

  const outcome = await geocodeVenueAddress(
    {
      addressLine1: venue.addressLine1,
      city: venue.city,
      postalCode: venue.postalCode,
    },
    options.geocode,
  );

  if (outcome.status !== "ok") {
    return outcome;
  }

  await db.venue.update({
    where: { id: venue.id },
    data: {
      latitude: outcome.latitude,
      longitude: outcome.longitude,
      geocodedAt: new Date(),
      geocodeSource: GeocodeSource.NOMINATIM,
    },
  });

  return {
    status: "ok",
    latitude: outcome.latitude,
    longitude: outcome.longitude,
  };
}

/**
 * Stores coordinates an admin typed or corrected by hand.
 *
 * Marks the row MANUAL, which is what stops a later bulk re-geocode from
 * silently undoing the correction.
 */
export async function setVenueCoordinatesManually(
  venueId: string,
  coordinates: { latitude: number; longitude: number },
  db: VenueCoordinatesPrisma = defaultPrisma,
): Promise<void> {
  await db.venue.update({
    where: { id: venueId },
    data: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      geocodedAt: new Date(),
      geocodeSource: GeocodeSource.MANUAL,
    },
  });
}

/** Clears coordinates so the venue drops off the map and can be re-geocoded. */
export async function clearVenueCoordinates(
  venueId: string,
  db: VenueCoordinatesPrisma = defaultPrisma,
): Promise<void> {
  await db.venue.update({
    where: { id: venueId },
    data: {
      latitude: null,
      longitude: null,
      geocodedAt: null,
      geocodeSource: null,
    },
  });
}

/**
 * One sentence an admin can act on, for appending to a venue-creation message.
 *
 * A failed geocode is reported but never presented as a failure of the venue
 * creation itself, because it is not one: the venue exists and works, it just
 * has no pin yet.
 */
export function describeGeocodeResult(result: GeocodeVenueResult): string {
  switch (result.status) {
    case "ok":
      return "Coordinates were found and saved, so this venue will appear on the map.";
    case "skipped":
      return result.reason;
    case "no_match":
      return `No coordinates were found (${result.reason}). The venue works normally but will not appear on the map until coordinates are added in Admin -> Venues.`;
    case "error":
      return `Geocoding failed (${result.reason}). The venue was still created; retry from Admin -> Venues.`;
  }
}

/**
 * How many venues one "Geocode all missing" click works through.
 *
 * The ceiling is the serverless function timeout, not the database. Nominatim's
 * policy forces one request per second, so the work is ~1.1s per venue however
 * fast everything else is: 15 venues is roughly 17 seconds, which clears a 60s
 * limit with room for a slow response or two. The admin clicks again for the
 * next batch, and because the query only ever selects venues with no
 * coordinates, clicking again never redoes finished work.
 */
export const GEOCODE_BATCH_SIZE = 15;

/**
 * What one venue costs in wall-clock time.
 *
 * Nominatim's one-request-per-second policy is enforced inside the geocoding
 * client, so this is the floor however fast the database and the network are.
 * Used to decide whether another venue still fits inside a time budget.
 */
const MS_PER_VENUE = 1_100;

export type GeocodeMissingResult = {
  attempted: number;
  ok: number;
  noMatch: number;
  errored: number;
  /** Still without coordinates once this batch finished. */
  remaining: number;
  /** True when a time budget ended the batch before it ran out of venues. */
  stoppedOnTime: boolean;
};

/**
 * Geocodes a bounded batch of venues that have no coordinates.
 *
 * This exists because production has no other route to a backfill. The
 * backfill script runs against whatever DATABASE_URL is on the machine, and
 * the production URL is deliberately not available on a developer machine, so
 * without this the only way to put existing venues on the map would be the
 * per-venue button, once each.
 *
 * Sequential on purpose. The one-request-per-second policy is enforced inside
 * the geocoding client, so a Promise.all here would not go faster -- it would
 * just queue every request at once and hold the function open the same length
 * of time with less to show for it if the batch is cut short.
 */
export async function geocodeMissingVenues(
  options: GeocodeVenueOptions & {
    limit?: number;
    /**
     * Stop once this much wall-clock time has gone, leaving the rest for the
     * next run.
     *
     * The admin button works to a fixed count because a person is waiting and
     * wants a predictable pause. The cron has the opposite problem: it gets
     * whatever is left of its 300s after an import of unpredictable length, so
     * it should spend what it has rather than guess a count. The check is made
     * against the time one more venue would take, so the loop stops before
     * overrunning rather than after.
     */
    timeBudgetMs?: number;
    /** Overridable so a test does not have to spend real seconds. */
    msPerVenue?: number;
  } = {},
): Promise<GeocodeMissingResult> {
  const db = options.db ?? defaultPrisma;
  const limit = options.limit ?? GEOCODE_BATCH_SIZE;
  const timeBudgetMs = options.timeBudgetMs ?? Number.POSITIVE_INFINITY;
  const msPerVenue = options.msPerVenue ?? MS_PER_VENUE;
  const startedAt = Date.now();
  let stoppedOnTime = false;

  const venues = await db.venue.findMany({
    where: { latitude: null },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true },
    take: limit,
  });

  const counts = { attempted: 0, ok: 0, noMatch: 0, errored: 0 };

  for (const venue of venues) {
    if (Date.now() - startedAt + msPerVenue > timeBudgetMs) {
      stoppedOnTime = true;
      break;
    }

    const result = await geocodeVenueById(venue.id, {
      db,
      mode: "fillMissing",
      geocode: options.geocode,
    });

    counts.attempted += 1;

    if (result.status === "ok") {
      counts.ok += 1;
    } else if (result.status === "no_match") {
      counts.noMatch += 1;
    } else if (result.status === "error") {
      counts.errored += 1;
    }
  }

  const remaining = await db.venue.count({ where: { latitude: null } });

  return { ...counts, remaining, stoppedOnTime };
}

/** One sentence for the admin, describing what a batch did and what is left. */
export function describeGeocodeMissingResult(
  result: GeocodeMissingResult,
): string {
  if (result.attempted === 0) {
    return "Every venue already has coordinates.";
  }

  const parts = [`Geocoded ${result.ok} of ${result.attempted}`];

  if (result.noMatch > 0) {
    parts.push(`${result.noMatch} had no match`);
  }

  if (result.errored > 0) {
    parts.push(`${result.errored} errored`);
  }

  const summary = parts.join(", ") + ".";

  return result.remaining > 0
    ? `${summary} ${result.remaining} still without coordinates -- run it again for the next batch.`
    : `${summary} Every venue now has coordinates.`;
}
