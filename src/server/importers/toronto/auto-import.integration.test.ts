import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import dropInFixture from "../../../../tests/fixtures/toronto/drop-in-sample.json";
import locationsFixture from "../../../../tests/fixtures/toronto/locations-sample.json";
import type {
  CkanPackage,
  CkanResource,
  DatastorePage,
  TorontoCkanClient,
} from "./ckan";
import { runTorontoAutoImport } from "./auto-import";

vi.mock("server-only", () => ({}));

const dropIns = dropInFixture as { basketballRecords: unknown[] };
const locations = locationsFixture as { sampleRecords: unknown[] };

const SOURCE_MODIFIED_AT = "2026-07-01T12:00:00.000Z";

const dropInResource = {
  id: "drop-in-resource",
  name: "Drop-in",
  format: "CSV",
  datastore_active: true,
  last_modified: SOURCE_MODIFIED_AT,
} satisfies CkanResource;

const locationsResource = {
  id: "locations-resource",
  name: "Locations",
  format: "CSV",
  datastore_active: true,
  last_modified: SOURCE_MODIFIED_AT,
} satisfies CkanResource;

const facilitiesResource = {
  id: "facilities-resource",
  name: "Facilities",
  format: "CSV",
  datastore_active: true,
  last_modified: SOURCE_MODIFIED_AT,
} satisfies CkanResource;

// Unlike the dry run's own fake client, this package lists its resources,
// because refresh detection reads them straight off package_show.
function stubPackage(modified = SOURCE_MODIFIED_AT): CkanPackage {
  return {
    id: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    name: "registered-programs-and-drop-in-courses-offering",
    title: "Registered Programs and Drop In Courses Offering",
    metadata_modified: modified,
    resources: [
      { ...dropInResource, last_modified: modified },
      { ...locationsResource, last_modified: modified },
      { ...facilitiesResource, last_modified: modified },
    ],
  };
}

function createFakeCkanClient(modified = SOURCE_MODIFIED_AT): TorontoCkanClient {
  const pkg = stubPackage(modified);
  const pages = new Map<string, DatastorePage>([
    [
      dropInResource.id,
      {
        fields: [],
        records: dropIns.basketballRecords as Record<string, unknown>[],
        total: dropIns.basketballRecords.length,
      },
    ],
    [
      locationsResource.id,
      {
        fields: [],
        records: locations.sampleRecords as Record<string, unknown>[],
        total: locations.sampleRecords.length,
      },
    ],
    [facilitiesResource.id, { fields: [], records: [], total: 0 }],
  ]);

  return {
    getPackage: async () => pkg,
    findDropInResource: async () => ({
      ...dropInResource,
      last_modified: modified,
    }),
    findLocationsResource: async () => ({
      ...locationsResource,
      last_modified: modified,
    }),
    findFacilitiesResource: async () => ({
      ...facilitiesResource,
      last_modified: modified,
    }),
    fetchAllDatastoreRecords: async (resource) => {
      const page = pages.get(resource.id);

      if (!page) {
        throw new Error(`Unexpected resource ${resource.id}`);
      }

      return page;
    },
  };
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
      name: "City of Toronto Drop-In Auto Import Test",
      sourceType: RunSourceType.CITY,
      url: "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/",
      providerKey: "toronto-drop-in",
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

async function createVenues() {
  await prisma.venue.create({
    data: {
      name: "East York Community Recreation Centre",
      addressLine1: "1081 1/2 Pape Ave",
      city: "Toronto",
    },
  });
  await prisma.venue.create({
    data: {
      name: "Milliken Park Community Recreation Centre",
      addressLine1: "4325 McCowan Rd",
      city: "Toronto",
      postalCode: "M1V4P1",
    },
  });
}

// A batch recording exactly the source state the stub client reports, so
// refresh detection has a matching baseline to compare against.
async function createMatchingBatch(scheduleSourceId: string) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "test",
      mode: ImportBatchMode.DRY_RUN,
      status: ImportBatchStatus.SUCCEEDED,
      isCompleteSnapshot: true,
      completedAt: new Date("2026-07-01T13:00:00.000Z"),
      dropInResourceId: dropInResource.id,
      locationsResourceId: locationsResource.id,
      facilitiesResourceId: facilitiesResource.id,
      dropInResourceLastModifiedAt: new Date(SOURCE_MODIFIED_AT),
      locationsResourceLastModifiedAt: new Date(SOURCE_MODIFIED_AT),
      facilitiesResourceLastModifiedAt: new Date(SOURCE_MODIFIED_AT),
    },
  });
}

describe("runTorontoAutoImport", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("does no work when the source has not refreshed", async () => {
    const scheduleSource = await createScheduleSource();
    const baseline = await createMatchingBatch(scheduleSource.id);

    const result = await runTorontoAutoImport({
      db: prisma,
      ckanClient: createFakeCkanClient(),
    });

    expect(result.status).toBe("SKIPPED_NO_REFRESH");
    expect(result.refresh.reason).toBe("UNCHANGED");
    expect(result.dryRun).toBeNull();
    expect(result.apply).toBeNull();

    // The important half: no new batch, so six quiet days a week cost nothing.
    await expect(prisma.importBatch.count()).resolves.toBe(1);
    expect(result.refresh.comparedBatchId).toBe(baseline.id);
  });

  it("imports and applies when the source has refreshed", async () => {
    const scheduleSource = await createScheduleSource();
    await createVenues();
    await createMatchingBatch(scheduleSource.id);

    const result = await runTorontoAutoImport({
      db: prisma,
      ckanClient: createFakeCkanClient("2026-07-08T12:00:00.000Z"),
    });

    expect(result.refresh.reason).toBe("RESOURCE_MODIFIED");
    expect(result.status).toBe("IMPORTED_AND_APPLIED");
    expect(result.dryRun?.isCompleteSnapshot).toBe(true);
    expect(result.gate?.canAutoApply).toBe(true);

    // The apply batch has to have acted on what the dry run proposed, which is
    // what makes this an orchestration test rather than two unit tests.
    expect(result.apply?.alreadyApplied).toBe(false);
    expect(result.apply?.counts.createdCount).toBe(
      result.dryRun?.counts.createdCount,
    );
    await expect(
      prisma.run.count({
        where: {
          scheduleSourceId: scheduleSource.id,
        },
      }),
    ).resolves.toBe(result.dryRun?.counts.createdCount);
  });

  it("builds the batch but leaves it for review when the gate declines", async () => {
    const scheduleSource = await createScheduleSource();
    await createVenues();
    await createMatchingBatch(scheduleSource.id);

    const result = await runTorontoAutoImport({
      db: prisma,
      ckanClient: createFakeCkanClient("2026-07-08T12:00:00.000Z"),
      // Any batch at all now trips the missing-run ceiling.
      limits: { maxMissingCount: -1 },
    });

    expect(result.status).toBe("IMPORTED_HELD_FOR_REVIEW");
    expect(result.dryRun).not.toBeNull();
    expect(result.gate?.canAutoApply).toBe(false);
    expect(result.gate?.blockers.map((blocker) => blocker.code)).toContain(
      "TOO_MANY_MISSING",
    );
    expect(result.apply).toBeNull();

    // Held means held: the dry run is on record, but nothing was published.
    await expect(
      prisma.importBatch.count({
        where: {
          mode: ImportBatchMode.APPLY,
        },
      }),
    ).resolves.toBe(0);
    await expect(prisma.run.count()).resolves.toBe(0);
  });
});
