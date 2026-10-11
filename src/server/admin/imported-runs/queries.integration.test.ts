import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { applyImportBatch } from "./apply-import-batch";
import { getAdminAutomatedImportStatus } from "./queries";

vi.mock("server-only", () => ({}));

async function cleanDatabase() {
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.scheduleSource.deleteMany();
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
