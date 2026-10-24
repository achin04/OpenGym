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
