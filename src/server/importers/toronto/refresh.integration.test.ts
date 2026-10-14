import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import type { CkanPackage } from "./ckan";
import { detectTorontoRefresh } from "./refresh";

vi.mock("server-only", () => ({}));

const DROP_IN_RESOURCE_ID = "drop-in-resource";
const LOCATIONS_RESOURCE_ID = "locations-resource";
const FACILITIES_RESOURCE_ID = "facilities-resource";
const SOURCE_MODIFIED_AT = new Date("2026-09-17T09:00:00.000Z");

async function cleanDatabase() {
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.scheduleSource.deleteMany();
}

async function createScheduleSource() {
  return prisma.scheduleSource.create({
    data: {
      name: "City of Toronto Drop-In Refresh Test",
      sourceType: RunSourceType.CITY,
      url: "https://open.toronto.ca/dataset/refresh-detection-test/",
      providerKey: "toronto-drop-in-refresh-test",
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

// A package_show payload whose resources match SOURCE_MODIFIED_AT, so a batch
// created by createBatch() below is an exact match unless a test says otherwise.
function stubPackage(modifiedAt = SOURCE_MODIFIED_AT): CkanPackage {
  return {
    id: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    name: "registered-programs-and-drop-in-courses-offering",
    title: "Registered Programs and Drop-In Courses Offering",
    metadata_modified: "2026-09-17T10:00:00.000Z",
    resources: [
      {
        id: DROP_IN_RESOURCE_ID,
        name: "Drop-in",
        datastore_active: true,
        last_modified: modifiedAt.toISOString(),
      },
      {
        id: LOCATIONS_RESOURCE_ID,
        name: "Locations",
        datastore_active: true,
        last_modified: modifiedAt.toISOString(),
      },
      {
        id: FACILITIES_RESOURCE_ID,
        name: "Facilities",
        datastore_active: true,
        last_modified: modifiedAt.toISOString(),
      },
    ],
  };
}

function stubClient(pkg: CkanPackage = stubPackage()) {
  return {
    getPackage: async () => pkg,
  };
}

async function createBatch(
  scheduleSourceId: string,
  overrides: {
    status?: ImportBatchStatus;
    isCompleteSnapshot?: boolean;
    completedAt?: Date | null;
    startedAt?: Date;
    dropInResourceLastModifiedAt?: Date | null;
  } = {},
) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "test",
      mode: ImportBatchMode.DRY_RUN,
      status: overrides.status ?? ImportBatchStatus.SUCCEEDED,
      isCompleteSnapshot: overrides.isCompleteSnapshot ?? true,
      completedAt:
        overrides.completedAt === undefined
          ? new Date("2026-09-17T12:00:00.000Z")
          : overrides.completedAt,
      startedAt: overrides.startedAt ?? new Date("2026-09-17T11:59:00.000Z"),
      dropInResourceId: DROP_IN_RESOURCE_ID,
      locationsResourceId: LOCATIONS_RESOURCE_ID,
      facilitiesResourceId: FACILITIES_RESOURCE_ID,
      dropInResourceLastModifiedAt:
        overrides.dropInResourceLastModifiedAt === undefined
          ? SOURCE_MODIFIED_AT
          : overrides.dropInResourceLastModifiedAt,
      locationsResourceLastModifiedAt: SOURCE_MODIFIED_AT,
      facilitiesResourceLastModifiedAt: SOURCE_MODIFIED_AT,
    },
  });
}

describe("detectTorontoRefresh", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("reports a refresh when the source has never been imported", async () => {
    const scheduleSource = await createScheduleSource();

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(),
    });

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("NO_PREVIOUS_SNAPSHOT");
  });

  it("reports no refresh when the newest trustworthy batch matches the source", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createBatch(scheduleSource.id);

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(),
    });

    expect(detection.hasRefreshed).toBe(false);
    expect(detection.reason).toBe("UNCHANGED");
    expect(detection.comparedBatchId).toBe(batch.id);
  });

  it("reports a refresh when the source has moved on from that batch", async () => {
    const scheduleSource = await createScheduleSource();
    await createBatch(scheduleSource.id);

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(stubPackage(new Date("2026-09-24T09:00:00.000Z"))),
    });

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
  });

  it("ignores an incomplete snapshot, so a bad read cannot suppress the next import", async () => {
    const scheduleSource = await createScheduleSource();
    await createBatch(scheduleSource.id, { isCompleteSnapshot: false });

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(),
    });

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("NO_PREVIOUS_SNAPSHOT");
  });

  it("ignores a batch that is still running", async () => {
    const scheduleSource = await createScheduleSource();
    await createBatch(scheduleSource.id, {
      status: ImportBatchStatus.RUNNING,
      completedAt: null,
    });

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(),
    });

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("NO_PREVIOUS_SNAPSHOT");
  });

  it("compares against the newest trustworthy batch, not an older matching one", async () => {
    const scheduleSource = await createScheduleSource();
    await createBatch(scheduleSource.id, {
      startedAt: new Date("2026-09-10T11:59:00.000Z"),
    });
    const newest = await createBatch(scheduleSource.id, {
      startedAt: new Date("2026-09-17T11:59:00.000Z"),
      dropInResourceLastModifiedAt: new Date("2026-09-24T09:00:00.000Z"),
    });

    const detection = await detectTorontoRefresh({
      db: prisma,
      scheduleSourceId: scheduleSource.id,
      client: stubClient(),
    });

    // The older batch matches the stub exactly; the newer one does not. Reading
    // the newer one is what keeps detection honest about current state.
    expect(detection.comparedBatchId).toBe(newest.id);
    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
  });
});
