import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RunSourceType, VenueMatchStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import locationsFixture from "../../../../tests/fixtures/toronto/locations-sample.json";
import {
  normalizeTorontoLocationRow,
  torontoLocationRowSchema,
  type TorontoLocationRow,
} from "./normalization";
import { findOrCreateTorontoExternalVenueRef } from "./venues";

vi.mock("server-only", () => ({}));

type TorontoLocationsFixture = {
  sampleRecords: unknown[];
};

const locations = locationsFixture as TorontoLocationsFixture;

function findLocationFixtureRow(locationId: number): TorontoLocationRow {
  const rawLocation = locations.sampleRecords.find((record) => {
    return (
      typeof record === "object" &&
      record !== null &&
      "Location ID" in record &&
      record["Location ID"] === locationId
    );
  });

  return torontoLocationRowSchema.parse(rawLocation);
}

async function cleanDatabase() {
  await prisma.externalVenueRef.deleteMany();
  await prisma.rsvp.deleteMany();
  await prisma.run.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function createScheduleSource() {
  return prisma.scheduleSource.create({
    data: {
      name: "City of Toronto Drop-In Integration Test",
      sourceType: RunSourceType.CITY,
      url: "https://open.toronto.ca/test/drop-in",
      providerKey: "toronto-drop-in-integration-test",
    },
  });
}

describe("findOrCreateTorontoExternalVenueRef", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("creates a matched external venue reference for an exact venue match", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await prisma.venue.create({
      data: {
        name: "Milliken Park Community Recreation Centre",
        addressLine1: "4325 McCowan Rd",
        city: "Toronto",
        postalCode: "M1V4P1",
      },
    });
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));
    const seenAt = new Date("2026-07-09T12:00:00.000Z");

    const result = await findOrCreateTorontoExternalVenueRef({
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: venue.id,
      reason: "exact_name_address",
    });
    expect(result.externalVenueRef).toMatchObject({
      scheduleSourceId: scheduleSource.id,
      externalId: "405",
      venueId: venue.id,
      sourceName: "Milliken Park Community Recreation Centre",
      sourceAddressLine1: "4325 Mccowan Rd",
      sourcePostalCode: "M1V 4P1",
      sourceUrl:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=405",
      matchStatus: VenueMatchStatus.MATCHED,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    });
  });

  it("creates a pending external venue reference when no exact venue match exists", async () => {
    const scheduleSource = await createScheduleSource();
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));

    const result = await findOrCreateTorontoExternalVenueRef({
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "no_exact_match",
    });
    expect(result.externalVenueRef).toMatchObject({
      scheduleSourceId: scheduleSource.id,
      externalId: "329",
      venueId: null,
      sourceName: "East York Community Recreation Centre",
      sourceAddressLine1: "1081 1/2 Pape Ave",
      sourcePostalCode: null,
      matchStatus: VenueMatchStatus.PENDING,
    });
  });

  it("keeps an existing external venue link and refreshes source fields", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await prisma.venue.create({
      data: {
        name: "Manually Linked Venue",
        addressLine1: "1 Manual Link Way",
        city: "Toronto",
      },
    });
    const existingRef = await prisma.externalVenueRef.create({
      data: {
        scheduleSourceId: scheduleSource.id,
        externalId: "329",
        venueId: venue.id,
        sourceName: "Old Source Name",
        sourceAddressLine1: "Old Address",
        sourcePostalCode: "M1M 1M1",
        sourceUrl: "https://example.test/old",
        matchStatus: VenueMatchStatus.MATCHED,
        firstSeenAt: new Date("2026-07-01T12:00:00.000Z"),
        lastSeenAt: new Date("2026-07-01T12:00:00.000Z"),
      },
    });
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));
    const seenAt = new Date("2026-07-09T12:00:00.000Z");

    const result = await findOrCreateTorontoExternalVenueRef({
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: venue.id,
      reason: "existing_external_ref",
    });
    expect(result.externalVenueRef).toMatchObject({
      id: existingRef.id,
      venueId: venue.id,
      sourceName: "East York Community Recreation Centre",
      sourceAddressLine1: "1081 1/2 Pape Ave",
      sourcePostalCode: null,
      matchStatus: VenueMatchStatus.MATCHED,
      firstSeenAt: new Date("2026-07-01T12:00:00.000Z"),
      lastSeenAt: seenAt,
    });
  });
});
