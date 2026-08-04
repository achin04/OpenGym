import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
  VenueMatchStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import {
  VenueResolutionError,
  createVenueFromExternalVenueRef,
  linkExternalVenueRefToVenue,
  removeImportedVenueCreationVenue,
  updateImportedVenueCreationVenue,
} from "./venue-resolution";

vi.mock("server-only", () => ({}));

const TORONTO_DROP_IN_SOURCE_URL =
  "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";

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

async function createImportedVenueCreation() {
  const scheduleSource = await createTorontoScheduleSource();
  const batch = await prisma.importBatch.create({
    data: {
      scheduleSourceId: scheduleSource.id,
      trigger: "test",
      mode: ImportBatchMode.DRY_RUN,
      status: ImportBatchStatus.SUCCEEDED,
    },
  });
  const venue = await prisma.venue.create({
    data: {
      name: "Imported Venue",
      addressLine1: "123 Import Ave.",
      city: "Toronto",
      postalCode: "M4B 1B3",
      websiteUrl: "https://example.com/imported-venue",
      phone: "416-555-0100",
    },
  });
  const externalVenueRef = await prisma.externalVenueRef.create({
    data: {
      scheduleSourceId: scheduleSource.id,
      externalId: "imported-venue-1",
      venueId: venue.id,
      sourceName: "Imported Venue Source",
      sourceAddressLine1: "123 Import Ave.",
      sourcePostalCode: "M4B 1B3",
      sourceUrl: "https://example.com/source",
      matchStatus: VenueMatchStatus.MATCHED,
    },
  });
  const importedVenueCreation = await prisma.importedVenueCreation.create({
    data: {
      batchId: batch.id,
      externalVenueRefId: externalVenueRef.id,
      venueId: venue.id,
      sourceName: externalVenueRef.sourceName,
      sourceAddressLine1: externalVenueRef.sourceAddressLine1,
      sourcePostalCode: externalVenueRef.sourcePostalCode,
      sourceUrl: externalVenueRef.sourceUrl,
    },
  });

  return {
    batch,
    externalVenueRef,
    importedVenueCreation,
    scheduleSource,
    venue,
  };
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

  it("updates the Venue fields for an imported venue creation", async () => {
    const { importedVenueCreation, venue } = await createImportedVenueCreation();

    await expect(
      updateImportedVenueCreationVenue({
        importedVenueCreationId: importedVenueCreation.id,
        name: "Updated Imported Venue",
        addressLine1: "456 Update Rd.",
        addressLine2: "Suite 2",
        city: "Toronto",
        postalCode: "M5V 0R6",
        websiteUrl: "https://example.com/updated",
        phone: "416-555-0199",
      }),
    ).resolves.toEqual({
      importedVenueCreationId: importedVenueCreation.id,
      venueId: venue.id,
    });

    await expect(
      prisma.venue.findUnique({
        where: {
          id: venue.id,
        },
      }),
    ).resolves.toMatchObject({
      name: "Updated Imported Venue",
      addressLine1: "456 Update Rd.",
      addressLine2: "Suite 2",
      city: "Toronto",
      postalCode: "M5V 0R6",
      websiteUrl: "https://example.com/updated",
      phone: "416-555-0199",
    });
  });

  it("removes an imported venue when no runs use it", async () => {
    const { externalVenueRef, importedVenueCreation, venue } =
      await createImportedVenueCreation();

    const result = await removeImportedVenueCreationVenue({
      importedVenueCreationId: importedVenueCreation.id,
    });

    expect(result).toMatchObject({
      importedVenueCreationId: importedVenueCreation.id,
      externalVenueRefId: externalVenueRef.id,
      venueId: venue.id,
    });
    expect(result.removedAt).toBeInstanceOf(Date);

    await expect(
      prisma.externalVenueRef.findUnique({
        where: {
          id: externalVenueRef.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: null,
      matchStatus: VenueMatchStatus.IGNORED,
    });
    await expect(
      prisma.importedVenueCreation.findUnique({
        where: {
          id: importedVenueCreation.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: null,
    });
    await expect(
      prisma.venue.findUnique({
        where: {
          id: venue.id,
        },
      }),
    ).resolves.toBeNull();
  });

  it("rejects removing an imported venue when existing runs use it", async () => {
    const { externalVenueRef, importedVenueCreation, venue } =
      await createImportedVenueCreation();
    await prisma.run.create({
      data: {
        title: "Existing run",
        sourceType: RunSourceType.CITY,
        startTime: new Date("2026-07-20T18:00:00.000Z"),
        endTime: new Date("2026-07-20T20:00:00.000Z"),
        venueId: venue.id,
      },
    });

    await expect(
      removeImportedVenueCreationVenue({
        importedVenueCreationId: importedVenueCreation.id,
      }),
    ).rejects.toThrow(
      "This Venue is used by existing runs. Edit it or reassign those runs before removing it.",
    );

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
    await expect(
      prisma.importedVenueCreation.findUnique({
        where: {
          id: importedVenueCreation.id,
        },
      }),
    ).resolves.toMatchObject({
      venueId: venue.id,
      removedAt: null,
    });
    await expect(
      prisma.venue.findUnique({
        where: {
          id: venue.id,
        },
      }),
    ).resolves.toMatchObject({
      id: venue.id,
    });
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
