import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RunSourceType,
  VenueMatchStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import {
  VenueResolutionError,
  createVenueFromExternalVenueRef,
  linkExternalVenueRefToVenue,
} from "./venue-resolution";

vi.mock("server-only", () => ({}));

const TORONTO_DROP_IN_SOURCE_URL =
  "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";

async function cleanDatabase() {
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.externalVenueRef.deleteMany();
  await prisma.rsvp.deleteMany();
  await prisma.run.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function createTorontoScheduleSource() {
  return prisma.scheduleSource.create({
    data: {
      name: "City of Toronto Drop-In Admin Import Test",
      sourceType: RunSourceType.CITY,
      url: TORONTO_DROP_IN_SOURCE_URL,
      providerKey: "toronto-drop-in",
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

async function createPendingExternalVenueRef() {
  const scheduleSource = await createTorontoScheduleSource();

  return prisma.externalVenueRef.create({
    data: {
      scheduleSourceId: scheduleSource.id,
      externalId: "3643",
      sourceName: "Canoe Landing Community Recreation Centre",
      sourceAddressLine1: "45 Fort York Blvd.",
      sourcePostalCode: "M5V 0R6",
      sourceUrl:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=3643",
      matchStatus: VenueMatchStatus.PENDING,
    },
  });
}

async function createProbeRun() {
  const venue = await prisma.venue.create({
    data: {
      name: "Probe Run Venue",
      addressLine1: "1 Probe Way",
      city: "Toronto",
    },
  });

  return prisma.run.create({
    data: {
      title: "Probe run",
      sourceType: RunSourceType.USER,
      startTime: new Date("2026-07-20T18:00:00.000Z"),
      endTime: new Date("2026-07-20T20:00:00.000Z"),
      venueId: venue.id,
    },
    select: {
      id: true,
      title: true,
      venueId: true,
      sourceExternalId: true,
      sourceFingerprint: true,
      sourceLastSeenAt: true,
    },
  });
}

async function runStateSnapshot() {
  return {
    count: await prisma.run.count(),
    rows: await prisma.run.findMany({
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        title: true,
        venueId: true,
        sourceExternalId: true,
        sourceFingerprint: true,
        sourceLastSeenAt: true,
      },
    }),
  };
}

describe("venue resolution service", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("links a pending Toronto external venue reference to an existing Venue without changing Runs", async () => {
    await createProbeRun();
    const beforeRuns = await runStateSnapshot();
    const externalVenueRef = await createPendingExternalVenueRef();
    const venue = await prisma.venue.create({
      data: {
        name: "Canoe Landing Community Recreation Centre",
        addressLine1: "45 Fort York Blvd.",
        city: "Toronto",
        postalCode: "M5V 0R6",
      },
    });

    await expect(
      linkExternalVenueRefToVenue({
        externalVenueRefId: externalVenueRef.id,
        venueId: venue.id,
      }),
    ).resolves.toEqual({
      externalVenueRefId: externalVenueRef.id,
      venueId: venue.id,
    });

    await expect(
      prisma.externalVenueRef.findUnique({
        where: {
          id: externalVenueRef.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: venue.id,
      matchStatus: VenueMatchStatus.MATCHED,
      sourceName: "Canoe Landing Community Recreation Centre",
      sourceAddressLine1: "45 Fort York Blvd.",
      sourcePostalCode: "M5V 0R6",
    });
    await expect(runStateSnapshot()).resolves.toEqual(beforeRuns);
  });

  it("rejects link when ExternalVenueRef does not exist", async () => {
    const venue = await prisma.venue.create({
      data: {
        name: "Existing Venue",
        addressLine1: "1 Existing Way",
        city: "Toronto",
      },
    });

    await expect(
      linkExternalVenueRefToVenue({
        externalVenueRefId: "missing_external_ref",
        venueId: venue.id,
      }),
    ).rejects.toThrow(VenueResolutionError);
  });

  it("rejects link when Venue does not exist", async () => {
    const externalVenueRef = await createPendingExternalVenueRef();

    await expect(
      linkExternalVenueRefToVenue({
        externalVenueRefId: externalVenueRef.id,
        venueId: "missing_venue",
      }),
    ).rejects.toThrow("Selected Venue was not found.");
  });

  it("rejects accidental relinking when the reference is already linked", async () => {
    const externalVenueRef = await createPendingExternalVenueRef();
    const linkedVenue = await prisma.venue.create({
      data: {
        name: "Already Linked Venue",
        addressLine1: "1 Linked Way",
        city: "Toronto",
      },
    });
    const otherVenue = await prisma.venue.create({
      data: {
        name: "Other Venue",
        addressLine1: "2 Linked Way",
        city: "Toronto",
      },
    });
    await prisma.externalVenueRef.update({
      where: {
        id: externalVenueRef.id,
      },
      data: {
        venueId: linkedVenue.id,
        matchStatus: VenueMatchStatus.MATCHED,
      },
    });

    await expect(
      linkExternalVenueRefToVenue({
        externalVenueRefId: externalVenueRef.id,
        venueId: otherVenue.id,
      }),
    ).rejects.toThrow("This source location is already linked to a Venue.");

    await expect(
      prisma.externalVenueRef.findUnique({
        where: {
          id: externalVenueRef.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: linkedVenue.id,
      matchStatus: VenueMatchStatus.MATCHED,
    });
  });

  it("creates a Venue from a pending source reference and links it transactionally without changing Runs", async () => {
    await createProbeRun();
    const beforeRuns = await runStateSnapshot();
    const externalVenueRef = await createPendingExternalVenueRef();

    const result = await createVenueFromExternalVenueRef({
      externalVenueRefId: externalVenueRef.id,
      name: "Canoe Landing Community Recreation Centre",
      addressLine1: "45 Fort York Blvd.",
      addressLine2: "",
      city: "Toronto",
      postalCode: "M5V 0R6",
      websiteUrl: "",
      phone: "",
    });

    const venue = await prisma.venue.findUniqueOrThrow({
      where: {
        id: result.venueId,
      },
    });
    expect(venue).toMatchObject({
      name: "Canoe Landing Community Recreation Centre",
      addressLine1: "45 Fort York Blvd.",
      city: "Toronto",
      postalCode: "M5V 0R6",
      websiteUrl:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=3643",
    });

    await expect(
      prisma.externalVenueRef.findUnique({
        where: {
          id: externalVenueRef.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: venue.id,
      matchStatus: VenueMatchStatus.MATCHED,
    });
    await expect(runStateSnapshot()).resolves.toEqual(beforeRuns);
  });

  it("rejects create when a likely duplicate Venue exists", async () => {
    const externalVenueRef = await createPendingExternalVenueRef();
    await prisma.venue.create({
      data: {
        name: "Canoe Landing Community Recreation Centre",
        addressLine1: "45 Fort York Blvd",
        city: "Toronto",
        postalCode: "M5V0R6",
      },
    });
    const venueCountBefore = await prisma.venue.count();

    await expect(
      createVenueFromExternalVenueRef({
        externalVenueRefId: externalVenueRef.id,
        name: "Canoe Landing Community Recreation Centre",
        addressLine1: "45 Fort York Blvd.",
        city: "Toronto",
        postalCode: "M5V 0R6",
        websiteUrl: "",
      }),
    ).rejects.toThrow(
      "A likely duplicate Venue already exists. Link that Venue instead.",
    );

    await expect(prisma.venue.count()).resolves.toBe(venueCountBefore);
    await expect(
      prisma.externalVenueRef.findUnique({
        where: {
          id: externalVenueRef.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: null,
      matchStatus: VenueMatchStatus.PENDING,
    });
  });
});
