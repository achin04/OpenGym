import "server-only";
import { z } from "zod";
import {
  buildVenueGeoQuery,
  type VenueGeoQueryParts,
} from "@/lib/geocoding/venue-geo-query";

export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

const SEARCH_PATH = "/search";
const REQUEST_TIMEOUT_MS = 10_000;

// Nominatim's usage policy requires an identifying User-Agent with a way to
// reach the operator, and caps unauthenticated use at one request per second.
// Both are conditions of use, not performance tuning: ignoring them is how a
// project gets its IP blocked.
const USER_AGENT =
  "OpenGym venue geocoder (https://github.com/opengym; contact: repository owner)";
const MIN_REQUEST_INTERVAL_MS = 1_100;

// Attribution owed for any coordinate derived from OSM data. Stored on the
// venue's provenance trail rather than hardcoded at the one display site, for
// the same reason ScheduleSource carries attributionText.
export const NOMINATIM_ATTRIBUTION =
  "Geocoding © OpenStreetMap contributors (ODbL)";

/**
 * A generous Ontario bounding box, used to reject obviously wrong matches.
 *
 * Nominatim will happily return a same-named street on another continent when
 * it cannot find the real one, and a single bad coordinate drags the map's
 * fitBounds across the Atlantic -- one bad row visibly breaks the whole map,
 * which is why this guard exists at all.
 *
 * Deliberately province-wide rather than Toronto-tight: a box drawn around the
 * GTA would start rejecting legitimate venues the moment OpenGym covers a
 * second Ontario city, and a guard that fires on good data is worse than none.
 */
const ONTARIO_BOUNDS = {
  minLatitude: 41.6,
  maxLatitude: 57.0,
  minLongitude: -95.2,
  maxLongitude: -74.3,
} as const;

type FetchLike = typeof fetch;

export type GeocodeOptions = {
  fetcher?: FetchLike;
  baseUrl?: string;
  requestTimeoutMs?: number;
  minRequestIntervalMs?: number;
};

/**
 * A discriminated union rather than `GeocodeResult | null` or a thrown error.
 *
 * Geocoding is enrichment: it is allowed to fail, and a failure must never
 * propagate as an exception into a venue-creation action and take the venue
 * down with it. Making the three outcomes distinct types means a caller
 * cannot read latitude without first proving the lookup succeeded, and a
 * no-match ("the address is not findable") stays distinguishable from an
 * error ("we could not ask"), which the admin UI reports differently.
 */
export type GeocodeOutcome =
  | {
      status: "ok";
      latitude: number;
      longitude: number;
      displayName: string;
    }
  | { status: "no_match"; reason: string }
  | { status: "error"; reason: string };

const nominatimPlaceSchema = z.looseObject({
  lat: z.string().min(1),
  lon: z.string().min(1),
  display_name: z.string().optional(),
});

const nominatimSearchSchema = z.array(nominatimPlaceSchema);

/**
 * Serialises every outbound request so that the one-per-second policy holds
 * even when callers run concurrently.
 *
 * Each caller claims the next free slot and advances the marker before it
 * awaits, so two simultaneous calls take slot N and slot N+1 rather than both
 * reading the same "last request" timestamp and firing together. A per-call
 * sleep in each caller could not provide that guarantee.
 */
let nextRequestSlotAt = 0;

async function claimRequestSlot(minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const slotAt = Math.max(now, nextRequestSlotAt);
  nextRequestSlotAt = slotAt + minIntervalMs;

  const waitMs = slotAt - now;

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/** Exported for tests, which must not depend on wall-clock throttle state. */
export function resetGeocodeThrottleForTests(): void {
  nextRequestSlotAt = 0;
}

function withinOntario(latitude: number, longitude: number): boolean {
  return (
    latitude >= ONTARIO_BOUNDS.minLatitude &&
    latitude <= ONTARIO_BOUNDS.maxLatitude &&
    longitude >= ONTARIO_BOUNDS.minLongitude &&
    longitude <= ONTARIO_BOUNDS.maxLongitude
  );
}

/**
 * Turns a raw Nominatim /search payload into an outcome.
 *
 * Pure and exported so the whole decision table -- empty array, unparseable
 * coordinates, a match in the wrong hemisphere -- is unit-testable without a
 * network call or a fake clock.
 */
export function parseNominatimSearchResponse(payload: unknown): GeocodeOutcome {
  const parsed = nominatimSearchSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: "error",
      reason: "Nominatim returned a response in an unexpected shape",
    };
  }

  const [place] = parsed.data;

  if (!place) {
    return { status: "no_match", reason: "No match for this address" };
  }

  const latitude = Number(place.lat);
  const longitude = Number(place.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      status: "error",
      reason: `Nominatim returned non-numeric coordinates (${place.lat}, ${place.lon})`,
    };
  }

  if (!withinOntario(latitude, longitude)) {
    return {
      status: "no_match",
      reason: `Match fell outside Ontario (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
    };
  }

  return {
    status: "ok",
    latitude,
    longitude,
    displayName: place.display_name ?? "",
  };
}

function buildSearchUrl(baseUrl: string, query: string): URL {
  const url = new URL(SEARCH_PATH, baseUrl);

  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  // Narrowing to Canada at the provider is cheaper and more accurate than
  // filtering a wrong answer out afterwards; the Ontario bounds check stays as
  // the backstop for the cases this does not catch.
  url.searchParams.set("countrycodes", "ca");

  return url;
}

/**
 * Geocodes one venue address. Never throws: every failure path, including a
 * timeout or a non-2xx response, comes back as an outcome.
 */
export async function geocodeVenueAddress(
  parts: VenueGeoQueryParts,
  options: GeocodeOptions = {},
): Promise<GeocodeOutcome> {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? NOMINATIM_BASE_URL;
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const minRequestIntervalMs =
    options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS;

  const query = buildVenueGeoQuery(parts);
  const url = buildSearchUrl(baseUrl, query);

  await claimRequestSlot(minRequestIntervalMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetcher(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "error",
        reason: `Nominatim responded ${response.status} ${response.statusText}`,
      };
    }

    return parseNominatimSearchResponse(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        status: "error",
        reason: `Nominatim request timed out after ${requestTimeoutMs}ms`,
      };
    }

    return {
      status: "error",
      reason:
        error instanceof Error ? error.message : "Nominatim request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
