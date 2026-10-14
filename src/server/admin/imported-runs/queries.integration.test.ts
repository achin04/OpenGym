import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgeGroup,
  ImportBatchMode,
  ImportBatchStatus,
  ImportItemAction,
  ImportReviewStatus,
  RunSourceType,
  SkillLevel,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { applyImportBatch } from "./apply-import-batch";
import {
  getAdminAutomatedImportStatus,
  getAdminImportBatchDetail,
} from "./queries";

vi.mock("server-only", () => ({}));

async function cleanDatabase() {
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.run.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.venue.deleteMany();
}

async function createScheduleSource(
  overrides: {
    lastSuccessfulImportAt?: Date | null;
    importLeaseExpiresAt?: Date | null;
  } = {},
) {
  return prisma.scheduleSource.create({
    data: {
      name: "City of Toronto Drop-In Status Test",
      sourceType: RunSourceType.CITY,
      url: "https://open.toronto.ca/dataset/automated-import-status-test/",
      providerKey: "toronto-drop-in-status-test",
      lastSuccessfulImportAt: overrides.lastSuccessfulImportAt ?? null,
      importLeaseExpiresAt: overrides.importLeaseExpiresAt ?? null,
    },
  });
}

async function createDryRunBatch(
  scheduleSourceId: string,
  overrides: {
    startedAt?: Date;
    status?: ImportBatchStatus;
    missingCount?: number;
    errorCount?: number;
  } = {},
) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "auto:2026-09-17T08:00:00.000Z",
      mode: ImportBatchMode.DRY_RUN,
      status: overrides.status ?? ImportBatchStatus.SUCCEEDED,
      isCompleteSnapshot: true,
      startedAt: overrides.startedAt ?? new Date("2026-09-17T08:00:00.000Z"),
      completedAt: new Date("2026-09-17T08:00:30.000Z"),
      missingCount: overrides.missingCount ?? 2,
      errorCount: overrides.errorCount ?? 0,
    },
  });
}

describe("getAdminImportBatchDetail", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("renders an apply item from its linked run when it carries no payload", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await prisma.venue.create({
      data: {
        name: "Trim Test Community Centre",
        addressLine1: "5 Trim Way",
        city: "Toronto",
      },
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: {
        batchId: batch.id,
        sourceKey: "create-1",
        sourceOccurrenceId: "source-detail-1",
        action: ImportItemAction.CREATE,
        reviewStatus: ImportReviewStatus.PENDING,
        normalizedPayload: {
          title: "Adult Basketball",
          description: null,
          sourceType: RunSourceType.CITY,
          startTime: "2026-10-20T22:00:00.000Z",
          endTime: "2026-10-21T00:00:00.000Z",
          price: null,
          skillLevel: SkillLevel.OPEN,
          ageGroup: AgeGroup.ADULT,
          maxPlayers: null,
          verified: true,
          sourceUrl: null,
          sourceExternalId: "source-detail-1",
          sourceSeriesId: null,
          sourceFingerprint: "source-detail-1:fingerprint",
          sourceStatus: "ACTIVE",
          reviewStatus: ImportReviewStatus.PENDING,
          venueId: venue.id,
          scheduleSourceId: scheduleSource.id,
        },
      },
    });

    const result = await applyImportBatch(batch.id);
    const detail = await getAdminImportBatchDetail(result.applyBatchId, prisma);
    const item = detail?.itemGroups.create[0];

    // The payload is gone, so everything the admin table shows for this row has
    // to come off the linked run instead.
    expect(item?.payload).toBeNull();
    expect(item?.run?.title).toBe("Adult Basketball");
    expect(item?.run?.startTime).toEqual(
      new Date("2026-10-20T22:00:00.000Z"),
    );
    expect(item?.run?.venueName).toBe("Trim Test Community Centre");
  });
});

describe("getAdminAutomatedImportStatus", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("returns nothing before any import has run", async () => {
    await createScheduleSource();

    await expect(getAdminAutomatedImportStatus(prisma)).resolves.toBeNull();
  });

  it("reports the newest dry run as unapplied", async () => {
    const scheduleSource = await createScheduleSource({
      lastSuccessfulImportAt: new Date("2026-09-10T08:00:00.000Z"),
    });
    await createDryRunBatch(scheduleSource.id, {
      startedAt: new Date("2026-09-10T08:00:00.000Z"),
    });
    const newest = await createDryRunBatch(scheduleSource.id, {
      startedAt: new Date("2026-09-17T08:00:00.000Z"),
    });

    const status = await getAdminAutomatedImportStatus(prisma);

    expect(status?.latestDryRun.id).toBe(newest.id);
    expect(status?.latestDryRun.isApplied).toBe(false);
    expect(status?.scheduleSource.lastSuccessfulImportAt).toEqual(
      new Date("2026-09-10T08:00:00.000Z"),
    );
  });

  it("reports a dry run as applied once it has been", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createDryRunBatch(scheduleSource.id);

    // Through the real apply path, so this fails if the two sides ever disagree
    // on how a dry run is linked to its apply batch.
    await applyImportBatch(batch.id);

    const status = await getAdminAutomatedImportStatus(prisma);

    expect(status?.latestDryRun.isApplied).toBe(true);
  });

  it("treats an unexpired lease as an import in flight", async () => {
    const scheduleSource = await createScheduleSource({
      importLeaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await createDryRunBatch(scheduleSource.id);

    const status = await getAdminAutomatedImportStatus(prisma);

    expect(status?.importInFlight).toBe(true);
  });

  it("ignores a lease left behind by a crashed run", async () => {
    const scheduleSource = await createScheduleSource({
      importLeaseExpiresAt: new Date(Date.now() - 60 * 1000),
    });
    await createDryRunBatch(scheduleSource.id);

    const status = await getAdminAutomatedImportStatus(prisma);

    expect(status?.importInFlight).toBe(false);
  });

  it("ignores apply batches when picking the newest run", async () => {
    const scheduleSource = await createScheduleSource();
    const dryRun = await createDryRunBatch(scheduleSource.id);
    await prisma.importBatch.create({
      data: {
        scheduleSourceId: scheduleSource.id,
        trigger: "manual",
        mode: ImportBatchMode.APPLY,
        status: ImportBatchStatus.SUCCEEDED,
        startedAt: new Date("2026-09-18T08:00:00.000Z"),
      },
    });

    const status = await getAdminAutomatedImportStatus(prisma);

    expect(status?.latestDryRun.id).toBe(dryRun.id);
  });
});
