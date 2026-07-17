import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgeGroup,
  ImportItemAction,
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
  SkillLevel,
  VenueMatchStatus,
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
import { runTorontoDryRunImport } from "./dry-run";
import {
  normalizeTorontoDropInRunCandidate,
  torontoDropInRowSchema,
  type TorontoDropInRow,
} from "./normalization";

vi.mock("server-only", () => ({}));

type TorontoDropInFixture = {
  basketballRecords: unknown[];
};

type TorontoLocationsFixture = {
  sampleRecords: unknown[];
};

const dropIns = dropInFixture as TorontoDropInFixture;
const locations = locationsFixture as TorontoLocationsFixture;
const firstBasketballRecord = dropIns.basketballRecords[0] as Record<
  string,
  unknown
>;

const packageFixture = {
  id: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
  name: "registered-programs-and-drop-in-courses-offering",
  title: "Registered Programs and Drop In Courses Offering",
  metadata_modified: "2026-07-01T12:00:00.000000",
  resources: [],
} satisfies CkanPackage;

const dropInResource = {
  id: "drop-in-resource",
  name: "Drop-in",
  format: "CSV",
  datastore_active: true,
  last_modified: "2026-07-01T12:00:00.000000",
} satisfies CkanResource;

const locationsResource = {
  id: "locations-resource",
  name: "Locations",
  format: "CSV",
  datastore_active: true,
  last_modified: "2026-07-01T12:00:00.000000",
} satisfies CkanResource;

const facilitiesResource = {
  id: "facilities-resource",
  name: "Facilities",
  format: "CSV",
  datastore_active: true,
  last_modified: "2026-07-01T12:00:00.000000",
} satisfies CkanResource;

function makeDropInRow(overrides: Record<string, unknown>): TorontoDropInRow {
  return torontoDropInRowSchema.parse({
    ...firstBasketballRecord,
    ...overrides,
  });
}

function createFakeCkanClient({
  dropInRecords,
  locationRecords,
}: {
  dropInRecords: unknown[];
  locationRecords: unknown[];
}): TorontoCkanClient {
  const pages = new Map<string, DatastorePage>([
    [
      dropInResource.id,
      {
        fields: [],
        records: dropInRecords as Record<string, unknown>[],
        total: dropInRecords.length,
      },
    ],
    [
      locationsResource.id,
      {
        fields: [],
        records: locationRecords as Record<string, unknown>[],
        total: locationRecords.length,
      },
    ],
    [
      facilitiesResource.id,
      {
        fields: [],
        records: [],
        total: 0,
      },
    ],
  ]);

  return {
    getPackage: async () => packageFixture,
    findDropInResource: async () => dropInResource,
    findLocationsResource: async () => locationsResource,
    findFacilitiesResource: async () => facilitiesResource,
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
      url: "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/",
      providerKey: "toronto-drop-in",
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

describe("runTorontoDryRunImport", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("persists a dry-run batch and items without changing Run rows", async () => {
    const scheduleSource = await createScheduleSource();
    const eastYorkVenue = await prisma.venue.create({
      data: {
        name: "East York Community Recreation Centre",
        addressLine1: "1081 1/2 Pape Ave",
        city: "Toronto",
      },
    });
    const millikenVenue = await prisma.venue.create({
      data: {
        name: "Milliken Park Community Recreation Centre",
        addressLine1: "4325 McCowan Rd",
        city: "Toronto",
        postalCode: "M1V4P1",
      },
    });
    const unchangedRow = makeDropInRow({});
    const updateRow = makeDropInRow({
      _id: 10_001,
      "Location ID": 405,
      Course_ID: 222_222,
      "Course Title": "Basketball (Women)",
      "First Date": "2026-06-22",
      "Last Date": "2026-06-22",
      "Start Hour": 18,
      "Start Minute": 0,
      "End Hour": 19,
      "End Min": 30,
    });
    const createRow = makeDropInRow({
      _id: 10_002,
      "Location ID": 405,
      Course_ID: 333_333,
      "First Date": "2026-06-23",
      "Last Date": "2026-06-23",
      "Start Hour": 18,
      "Start Minute": 0,
      "End Hour": 19,
      "End Min": 30,
    });
    const skippedRow = makeDropInRow({
      _id: 10_003,
      "Location ID": 63,
      Course_ID: 444_444,
      "First Date": "2026-06-24",
      "Last Date": "2026-06-24",
      "Start Hour": 18,
      "Start Minute": 0,
      "End Hour": 19,
      "End Min": 30,
    });
    const unchangedCandidate =
      normalizeTorontoDropInRunCandidate(unchangedRow);
    const updateCandidate = normalizeTorontoDropInRunCandidate(updateRow);
    const oldUpdateStartTime = new Date("2026-06-22T20:00:00.000Z");
    const existingUnchangedRun = await prisma.run.create({
      data: {
        title: unchangedCandidate.title,
        description: unchangedCandidate.description,
        sourceType: unchangedCandidate.sourceType,
        startTime: unchangedCandidate.startTime,
        endTime: unchangedCandidate.endTime,
        price: null,
        skillLevel: unchangedCandidate.skillLevel,
        ageGroup: unchangedCandidate.ageGroup,
        maxPlayers: null,
        verified: true,
        sourceUrl: unchangedCandidate.sourceUrl,
        sourceExternalId: unchangedCandidate.sourceExternalId,
        sourceSeriesId: unchangedCandidate.sourceSeriesId,
        sourceFingerprint: unchangedCandidate.sourceFingerprint,
        sourceAgeLabel: unchangedCandidate.sourceAgeLabel,
        sourceMinAge: unchangedCandidate.sourceMinAge,
        sourceMaxAge: unchangedCandidate.sourceMaxAge,
        venueId: eastYorkVenue.id,
        scheduleSourceId: scheduleSource.id,
      },
    });
    const existingUpdateRun = await prisma.run.create({
      data: {
        title: "Old Basketball Title",
        description: updateCandidate.description,
        sourceType: RunSourceType.CITY,
        startTime: oldUpdateStartTime,
        endTime: updateCandidate.endTime,
        price: null,
        skillLevel: SkillLevel.OPEN,
        ageGroup: AgeGroup.ADULT,
        maxPlayers: null,
        verified: true,
        sourceUrl: updateCandidate.sourceUrl,
        sourceExternalId: updateCandidate.sourceExternalId,
        sourceSeriesId: updateCandidate.sourceSeriesId,
        sourceFingerprint: "old-fingerprint",
        sourceAgeLabel: updateCandidate.sourceAgeLabel,
        sourceMinAge: updateCandidate.sourceMinAge,
        sourceMaxAge: updateCandidate.sourceMaxAge,
        venueId: millikenVenue.id,
        scheduleSourceId: scheduleSource.id,
      },
    });
    const summary = await runTorontoDryRunImport({
      ckanClient: createFakeCkanClient({
        dropInRecords: [unchangedRow, updateRow, createRow, skippedRow],
        locationRecords: locations.sampleRecords,
      }),
      now: new Date("2026-07-17T12:00:00.000Z"),
      trigger: "integration-test",
    });

    expect(summary.status).toBe(ImportBatchStatus.PARTIAL);
    expect(summary.counts).toMatchObject({
      dropInRecordCount: 4,
      basketballRecordCount: 4,
      createdCount: 1,
      updatedCount: 1,
      unchangedCount: 1,
      skippedCount: 1,
      errorCount: 0,
    });
    expect(summary.resources).toEqual({
      dropInResourceId: dropInResource.id,
      locationsResourceId: locationsResource.id,
      facilitiesResourceId: facilitiesResource.id,
    });

    const batch = await prisma.importBatch.findUniqueOrThrow({
      where: {
        id: summary.batchId,
      },
    });
    expect(batch).toMatchObject({
      scheduleSourceId: scheduleSource.id,
      trigger: "integration-test",
      mode: ImportBatchMode.DRY_RUN,
      status: ImportBatchStatus.PARTIAL,
      isCompleteSnapshot: true,
      dropInRecordCount: 4,
      basketballRecordCount: 4,
      createdCount: 1,
      updatedCount: 1,
      unchangedCount: 1,
      skippedCount: 1,
      errorCount: 0,
    });
    expect(batch.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(batch.completedAt?.toISOString()).toBe(
      "2026-07-17T12:00:00.000Z",
    );

    const items = await prisma.importItem.findMany({
      where: {
        batchId: summary.batchId,
      },
      orderBy: {
        sourceKey: "asc",
      },
    });
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.action).sort()).toEqual([
      ImportItemAction.CREATE,
      ImportItemAction.SKIPPED,
      ImportItemAction.UNCHANGED,
      ImportItemAction.UPDATE,
    ]);
    expect(
      items.find((item) => item.action === ImportItemAction.UPDATE)?.runId,
    ).toBe(existingUpdateRun.id);
    expect(
      items.find((item) => item.action === ImportItemAction.UNCHANGED)?.runId,
    ).toBe(existingUnchangedRun.id);
    expect(
      items.find((item) => item.action === ImportItemAction.SKIPPED)
        ?.errorMessage,
    ).toContain("pending venue match");

    const runsAfterDryRun = await prisma.run.findMany({
      orderBy: {
        id: "asc",
      },
    });
    expect(runsAfterDryRun).toHaveLength(2);
    expect(
      runsAfterDryRun.find((run) => run.id === existingUpdateRun.id),
    ).toMatchObject({
      title: "Old Basketball Title",
      startTime: oldUpdateStartTime,
      sourceFingerprint: "old-fingerprint",
    });

    const externalVenueRefs = await prisma.externalVenueRef.findMany({
      orderBy: {
        externalId: "asc",
      },
    });
    expect(externalVenueRefs).toHaveLength(3);
    expect(externalVenueRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: "329",
          venueId: eastYorkVenue.id,
          matchStatus: VenueMatchStatus.MATCHED,
        }),
        expect.objectContaining({
          externalId: "405",
          venueId: millikenVenue.id,
          matchStatus: VenueMatchStatus.MATCHED,
        }),
        expect.objectContaining({
          externalId: "63",
          venueId: null,
          matchStatus: VenueMatchStatus.PENDING,
        }),
      ]),
    );
  });
});
