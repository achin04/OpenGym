import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RunSourceType, VenueMatchStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import locationsFixture from "../../../../tests/fixtures/toronto/locations-sample.json";
import {
  normalizeTorontoLocationRow,
  torontoLocationRowSchema,
  type TorontoLocationRow,
} from "./normalization";
import {
  createTorontoVenueFromLocation,
  evaluateTorontoVenueAutoCreateEligibility,
  findOrCreateTorontoExternalVenueRef,
  resolveTorontoExternalVenueRef,
  TorontoVenueAutoCreateError,
} from "./venues";

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

async function createImportBatch(scheduleSourceId: string) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "integration-test",
    },
  });
}

describe("evaluateTorontoVenueAutoCreateEligibility", () => {
  const eastYorkLocation = normalizeTorontoLocationRow(findLocationFixtureRow(329));

  function venue(
    overrides: Partial<{
      id: string;
      name: string;
      addressLine1: string;
      city: string;
      postalCode: string | null;
    }> = {},
  ) {
    return {
      id: "venue_1",
      name: "East York Community Recreation Centre",
      addressLine1: "1081 1/2 Pape Ave",
      city: "Toronto",
      postalCode: null,
      ...overrides,
    };
  }

  it("allows auto-create when no exact or likely duplicate venue exists", () => {
    expect(
      evaluateTorontoVenueAutoCreateEligibility(eastYorkLocation, [
        venue({
          name: "Different Community Centre",
          addressLine1: "1 Other St",
          postalCode: "M4K 1A1",
        }),
      ]),
    ).toMatchObject({
      eligible: true,
      reason: "no_exact_match",
    });
  });

  it("does not auto-create when the location already matches an existing venue", () => {
    expect(
      evaluateTorontoVenueAutoCreateEligibility(eastYorkLocation, [venue()]),
    ).toMatchObject({
      eligible: false,
      reason: "already_matched",
    });
  });

  it("does not auto-create when exact matching is ambiguous", () => {
    expect(
      evaluateTorontoVenueAutoCreateEligibility(eastYorkLocation, [
        venue({ id: "venue_1" }),
        venue({ id: "venue_2" }),
      ]),
    ).toMatchObject({
      eligible: false,
      reason: "multiple_exact_matches",
    });
  });

  it("does not auto-create when source address is missing", () => {
    expect(
      evaluateTorontoVenueAutoCreateEligibility(
        {
          ...eastYorkLocation,
          sourceAddressLine1: null,
        },
        [],
      ),
    ).toMatchObject({
      eligible: false,
      reason: "missing_source_address",
    });
  });

  it("does not auto-create when a likely duplicate venue exists", () => {
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));

    expect(
      evaluateTorontoVenueAutoCreateEligibility(location, [
        venue({
          name: "Milliken Park Community Recreation Centre",
          addressLine1: "1 Different Address",
          postalCode: "M1V4P1",
        }),
      ]),
    ).toMatchObject({
      eligible: false,
      reason: "likely_duplicate_venue",
      duplicateVenue: expect.objectContaining({
        name: "Milliken Park Community Recreation Centre",
      }),
    });
  });
});

describe("createTorontoVenueFromLocation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("creates a venue, links the external ref, and writes an audit row transactionally", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));
    const seenAt = new Date("2026-07-09T12:00:00.000Z");

    const result = await createTorontoVenueFromLocation({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: result.venue.id,
      reason: "auto_created_from_source",
      venue: {
        name: "East York Community Recreation Centre",
        addressLine1: "1081 1/2 Pape Ave",
        city: "Toronto",
        postalCode: null,
        websiteUrl:
          "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
      },
      externalVenueRef: {
        scheduleSourceId: scheduleSource.id,
        externalId: "329",
        venueId: result.venue.id,
        sourceName: "East York Community Recreation Centre",
        sourceAddressLine1: "1081 1/2 Pape Ave",
        sourcePostalCode: null,
        matchStatus: VenueMatchStatus.MATCHED,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      },
      importedVenueCreation: {
        batchId: batch.id,
        externalVenueRefId: result.externalVenueRef.id,
        venueId: result.venue.id,
        sourceName: "East York Community Recreation Centre",
        sourceAddressLine1: "1081 1/2 Pape Ave",
        sourcePostalCode: null,
        sourceUrl:
          "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
        removedAt: null,
      },
    });

    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.externalVenueRef.count()).resolves.toBe(1);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(1);
  });

  it("updates an existing pending external venue ref instead of creating a second ref", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));
    const firstSeenAt = new Date("2026-07-01T12:00:00.000Z");
    const seenAt = new Date("2026-07-09T12:00:00.000Z");
    const existingRef = await prisma.externalVenueRef.create({
      data: {
        scheduleSourceId: scheduleSource.id,
        externalId: "329",
        sourceName: "Old Source Name",
        sourceAddressLine1: "Old Address",
        sourcePostalCode: "M1M 1M1",
        sourceUrl: "https://example.test/old",
        matchStatus: VenueMatchStatus.PENDING,
        firstSeenAt,
        lastSeenAt: firstSeenAt,
      },
    });

    const result = await createTorontoVenueFromLocation({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result.externalVenueRef).toMatchObject({
      id: existingRef.id,
      venueId: result.venue.id,
      sourceName: "East York Community Recreation Centre",
      sourceAddressLine1: "1081 1/2 Pape Ave",
      sourcePostalCode: null,
      matchStatus: VenueMatchStatus.MATCHED,
      firstSeenAt,
      lastSeenAt: seenAt,
    });
    expect(result.importedVenueCreation).toMatchObject({
      batchId: batch.id,
      externalVenueRefId: existingRef.id,
      venueId: result.venue.id,
    });
    await expect(prisma.externalVenueRef.count()).resolves.toBe(1);
  });

  it("rejects likely duplicates without creating a venue, ref, or audit row", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));
    await prisma.venue.create({
      data: {
        name: "Milliken Park Community Recreation Centre",
        addressLine1: "1 Different Address",
        city: "Toronto",
        postalCode: "M1V4P1",
      },
    });

    await expect(
      createTorontoVenueFromLocation({
        batchId: batch.id,
        scheduleSourceId: scheduleSource.id,
        location,
        seenAt: new Date("2026-07-09T12:00:00.000Z"),
      }),
    ).rejects.toThrow(TorontoVenueAutoCreateError);

    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.externalVenueRef.count()).resolves.toBe(0);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });
});

describe("resolveTorontoExternalVenueRef", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("returns an existing linked external venue ref as matched", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const venue = await prisma.venue.create({
      data: {
        name: "Already Linked Venue",
        addressLine1: "1 Linked Way",
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

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: venue.id,
      reason: "existing_external_ref",
      externalVenueRef: {
        id: existingRef.id,
        venueId: venue.id,
        sourceName: "East York Community Recreation Centre",
        sourceAddressLine1: "1081 1/2 Pape Ave",
        sourcePostalCode: null,
        matchStatus: VenueMatchStatus.MATCHED,
        firstSeenAt: new Date("2026-07-01T12:00:00.000Z"),
        lastSeenAt: seenAt,
      },
    });
    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });

  it("matches an existing exact venue without creating an audit row", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const venue = await prisma.venue.create({
      data: {
        name: "Milliken Park Community Recreation Centre",
        addressLine1: "4325 McCowan Rd",
        city: "Toronto",
        postalCode: "M1V4P1",
      },
    });
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: venue.id,
      reason: "exact_name_address",
      externalVenueRef: {
        scheduleSourceId: scheduleSource.id,
        externalId: "405",
        venueId: venue.id,
        matchStatus: VenueMatchStatus.MATCHED,
      },
    });
    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.externalVenueRef.count()).resolves.toBe(1);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });

  it("auto-creates a venue when no exact or likely duplicate venue exists", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      reason: "auto_created_from_source",
      venue: {
        name: "East York Community Recreation Centre",
        addressLine1: "1081 1/2 Pape Ave",
        city: "Toronto",
      },
      externalVenueRef: {
        externalId: "329",
        matchStatus: VenueMatchStatus.MATCHED,
      },
      importedVenueCreation: {
        batchId: batch.id,
        sourceName: "East York Community Recreation Centre",
      },
    });
    expect(result.externalVenueRef.venueId).toBe(result.venueId);
    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(1);
  });

  it("keeps an ignored external venue ref unresolved instead of auto-creating again", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));
    const existingRef = await prisma.externalVenueRef.create({
      data: {
        scheduleSourceId: scheduleSource.id,
        externalId: "329",
        sourceName: "East York Community Recreation Centre",
        sourceAddressLine1: "1081 1/2 Pape Ave",
        sourcePostalCode: null,
        sourceUrl:
          "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
        matchStatus: VenueMatchStatus.IGNORED,
      },
    });
    const seenAt = new Date("2026-07-09T12:00:00.000Z");

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.IGNORED,
      venueId: null,
      reason: "ignored_external_ref",
      externalVenueRef: {
        id: existingRef.id,
        venueId: null,
        matchStatus: VenueMatchStatus.IGNORED,
        lastSeenAt: seenAt,
      },
    });
    await expect(prisma.venue.count()).resolves.toBe(0);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });

  it("leaves a source location with missing address pending without auto-creating a venue", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = {
      ...normalizeTorontoLocationRow(findLocationFixtureRow(329)),
      sourceAddressLine1: null,
    };
    const seenAt = new Date("2026-07-09T12:00:00.000Z");

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt,
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "missing_source_address",
      externalVenueRef: {
        scheduleSourceId: scheduleSource.id,
        externalId: "329",
        venueId: null,
        sourceName: "East York Community Recreation Centre",
        sourceAddressLine1: null,
        matchStatus: VenueMatchStatus.PENDING,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      },
    });
    await expect(prisma.venue.count()).resolves.toBe(0);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });

  it("leaves a likely duplicate source location pending without auto-creating a venue", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createImportBatch(scheduleSource.id);
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));
    await prisma.venue.create({
      data: {
        name: "Milliken Park Community Recreation Centre",
        addressLine1: "1 Different Address",
        city: "Toronto",
        postalCode: "M1V4P1",
      },
    });

    const result = await resolveTorontoExternalVenueRef({
      batchId: batch.id,
      scheduleSourceId: scheduleSource.id,
      location,
      seenAt: new Date("2026-07-09T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "likely_duplicate_venue",
      externalVenueRef: {
        scheduleSourceId: scheduleSource.id,
        externalId: "405",
        venueId: null,
        matchStatus: VenueMatchStatus.PENDING,
      },
      duplicateVenue: expect.objectContaining({
        name: "Milliken Park Community Recreation Centre",
      }),
    });
    await expect(prisma.venue.count()).resolves.toBe(1);
    await expect(prisma.externalVenueRef.count()).resolves.toBe(1);
    await expect(prisma.importedVenueCreation.count()).resolves.toBe(0);
  });
});

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
