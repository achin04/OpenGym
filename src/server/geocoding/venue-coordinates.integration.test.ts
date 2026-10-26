import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GeocodeSource, RunSourceType, SourceRunStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { findMapVenues } from "@/server/venues/map-venues";
import johnInnesFixture from "../../../tests/fixtures/nominatim/search-john-innes.json";
import emptyFixture from "../../../tests/fixtures/nominatim/search-empty.json";
import {
  clearVenueCoordinates,
  geocodeMissingVenues,
  geocodeVenueById,
  setVenueCoordinatesManually,
} from "./venue-coordinates";

vi.mock("server-only", () => ({}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Every geocode call in this file goes through a stub: no network, ever.
 *
 * mockImplementation rather than mockResolvedValue, because the latter hands
 * back the same Response object on every call and a response body can only be
 * read once -- the second read throws and the call looks like a geocoder
 * failure. It never showed while each test geocoded a single venue; a batch
 * geocoding several is the first thing to call the stub twice.
 */
function stubGeocode(body: unknown) {
  return {
    geocode: {
      fetcher: vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(body))),
      minRequestIntervalMs: 0,
    },
  } as const;
}

async function cleanDatabase() {
  await prisma.importedVenueCreation.deleteMany();
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.externalVenueRef.deleteMany();
  await prisma.rsvp.deleteMany();
  await prisma.run.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function createVenue(name = "John Innes Community Recreation Centre") {
  return prisma.venue.create({
    data: {
      name,
      addressLine1: "150 Sherbourne St",
      city: "Toronto",
      postalCode: "M5A 2R6",
    },
  });
}

async function createUpcomingRun(venueId: string, startTime: Date) {
  const scheduleSource = await prisma.scheduleSource.create({
    data: {
      name: "Map query test source",
      sourceType: RunSourceType.CITY,
      url: `https://example.test/${venueId}`,
    },
  });

  return prisma.run.create({
    data: {
      title: "Basketball",
      sourceType: RunSourceType.CITY,
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      venueId,
      scheduleSourceId: scheduleSource.id,
      sourceStatus: SourceRunStatus.ACTIVE,
    },
  });
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe("geocodeVenueById", () => {
  it("stores coordinates and records Nominatim as the source", async () => {
    const venue = await createVenue();

    const result = await geocodeVenueById(venue.id, stubGeocode(johnInnesFixture));

    expect(result.status).toBe("ok");

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.latitude).toBeCloseTo(43.6555127, 6);
    expect(stored.longitude).toBeCloseTo(-79.3700321, 6);
    expect(stored.geocodeSource).toBe(GeocodeSource.NOMINATIM);
    expect(stored.geocodedAt).not.toBeNull();
  });

  // The failure path the whole design hangs on: geocoding is enrichment, so a
  // venue must survive it cleanly rather than ending up half-written.
  it("leaves coordinates null when there is no match", async () => {
    const venue = await createVenue();

    const result = await geocodeVenueById(venue.id, stubGeocode(emptyFixture));

    expect(result.status).toBe("no_match");

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.latitude).toBeNull();
    expect(stored.longitude).toBeNull();
    expect(stored.geocodeSource).toBeNull();
  });

  it("does not call the geocoder at all in fillMissing mode when coordinates exist", async () => {
    const venue = await createVenue();
    await setVenueCoordinatesManually(venue.id, {
      latitude: 1,
      longitude: 2,
    });

    const options = stubGeocode(johnInnesFixture);
    const result = await geocodeVenueById(venue.id, {
      ...options,
      mode: "fillMissing",
    });

    expect(result.status).toBe("skipped");
    expect(options.geocode.fetcher).not.toHaveBeenCalled();
  });

  // The reason Venue.geocodeSource exists. Without it this assertion could not
  // even be written, and a bulk refresh would quietly undo manual corrections.
  it("refuses to overwrite a manual correction in refreshAuto mode", async () => {
    const venue = await createVenue();
    await setVenueCoordinatesManually(venue.id, {
      latitude: 43.5,
      longitude: -79.5,
    });

    const result = await geocodeVenueById(venue.id, {
      ...stubGeocode(johnInnesFixture),
      mode: "refreshAuto",
    });

    expect(result.status).toBe("skipped");

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.latitude).toBe(43.5);
    expect(stored.geocodeSource).toBe(GeocodeSource.MANUAL);
  });

  it("re-geocodes a Nominatim-sourced venue in refreshAuto mode", async () => {
    const venue = await createVenue();
    await geocodeVenueById(venue.id, stubGeocode(johnInnesFixture));

    await prisma.venue.update({
      where: { id: venue.id },
      data: { latitude: 0, longitude: 0 },
    });

    const result = await geocodeVenueById(venue.id, {
      ...stubGeocode(johnInnesFixture),
      mode: "refreshAuto",
    });

    expect(result.status).toBe("ok");

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.latitude).toBeCloseTo(43.6555127, 6);
  });

  it("overwrites a manual correction only in force mode", async () => {
    const venue = await createVenue();
    await setVenueCoordinatesManually(venue.id, {
      latitude: 43.5,
      longitude: -79.5,
    });

    const result = await geocodeVenueById(venue.id, {
      ...stubGeocode(johnInnesFixture),
      mode: "force",
    });

    expect(result.status).toBe("ok");

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.geocodeSource).toBe(GeocodeSource.NOMINATIM);
  });
});

describe("clearVenueCoordinates", () => {
  it("removes coordinates and their provenance together", async () => {
    const venue = await createVenue();
    await geocodeVenueById(venue.id, stubGeocode(johnInnesFixture));

    await clearVenueCoordinates(venue.id);

    const stored = await prisma.venue.findUniqueOrThrow({
      where: { id: venue.id },
    });

    expect(stored.latitude).toBeNull();
    expect(stored.longitude).toBeNull();
    expect(stored.geocodedAt).toBeNull();
    expect(stored.geocodeSource).toBeNull();
  });
});

describe("findMapVenues", () => {
  it("returns only venues that have both coordinates and an upcoming run", async () => {
    const now = new Date();

    const mapped = await createVenue("Mapped venue");
    await geocodeVenueById(mapped.id, stubGeocode(johnInnesFixture));
    await createUpcomingRun(mapped.id, new Date(now.getTime() + 60 * 60 * 1000));

    // Has a run, but no coordinates: usable everywhere else, absent here.
    const withoutCoordinates = await createVenue("No coordinates venue");
    await createUpcomingRun(
      withoutCoordinates.id,
      new Date(now.getTime() + 60 * 60 * 1000),
    );

    // Has coordinates, but nothing upcoming: a pin with nothing behind it.
    const pastOnly = await createVenue("Past runs venue");
    await geocodeVenueById(pastOnly.id, stubGeocode(johnInnesFixture));
    await createUpcomingRun(
      pastOnly.id,
      new Date(now.getTime() - 48 * 60 * 60 * 1000),
    );

    const venues = await findMapVenues(now);

    expect(venues.map((venue) => venue.name)).toEqual(["Mapped venue"]);
    expect(venues[0]).toMatchObject({
      id: mapped.id,
      latitude: expect.closeTo(43.6555127, 6),
      longitude: expect.closeTo(-79.3700321, 6),
    });
  });

  it("excludes a venue whose only upcoming run is not ACTIVE", async () => {
    const now = new Date();

    const venue = await createVenue("Removed run venue");
    await geocodeVenueById(venue.id, stubGeocode(johnInnesFixture));
    const run = await createUpcomingRun(
      venue.id,
      new Date(now.getTime() + 60 * 60 * 1000),
    );
    await prisma.run.update({
      where: { id: run.id },
      data: { sourceStatus: SourceRunStatus.REMOVED },
    });

    await expect(findMapVenues(now)).resolves.toEqual([]);
  });
});

describe("geocodeMissingVenues", () => {
  it("fills a bounded batch and reports what is left", async () => {
    for (const name of ["A venue", "B venue", "C venue", "D venue"]) {
      await createVenue(name);
    }

    const options = stubGeocode(johnInnesFixture);
    const result = await geocodeMissingVenues({ ...options, limit: 2 });

    expect(result.attempted).toBe(2);
    expect(result.ok).toBe(2);
    // The ceiling is a function timeout, so the batch must stop at the limit
    // rather than working through everything it finds.
    expect(result.remaining).toBe(2);
    expect(options.geocode.fetcher).toHaveBeenCalledTimes(2);
  });

  it("picks up where the previous batch stopped", async () => {
    for (const name of ["A venue", "B venue", "C venue"]) {
      await createVenue(name);
    }

    await geocodeMissingVenues({ ...stubGeocode(johnInnesFixture), limit: 2 });
    const second = await geocodeMissingVenues({
      ...stubGeocode(johnInnesFixture),
      limit: 2,
    });

    expect(second.attempted).toBe(1);
    expect(second.remaining).toBe(0);
  });

  it("does nothing when every venue already has coordinates", async () => {
    const venue = await createVenue();
    await geocodeVenueById(venue.id, stubGeocode(johnInnesFixture));

    const options = stubGeocode(johnInnesFixture);
    const result = await geocodeMissingVenues(options);

    expect(result.attempted).toBe(0);
    expect(result.remaining).toBe(0);
    expect(options.geocode.fetcher).not.toHaveBeenCalled();
  });

  // A venue the geocoder cannot place must not block the batch behind it, or
  // one bad address stops every later venue from ever being geocoded.
  it("counts a no-match and carries on", async () => {
    await createVenue("A venue");
    await createVenue("B venue");

    const result = await geocodeMissingVenues(stubGeocode(emptyFixture));

    expect(result.attempted).toBe(2);
    expect(result.ok).toBe(0);
    expect(result.noMatch).toBe(2);
    expect(result.remaining).toBe(2);
  });
});
