import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgeGroup,
  ImportBatchMode,
  ImportBatchStatus,
  ImportItemAction,
  ImportReviewStatus,
  RunSourceType,
  SkillLevel,
  SourceRunStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { ApplyImportBatchError, applyImportBatch } from "./apply-import-batch";

vi.mock("server-only", () => ({}));

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

async function createScheduleSource(suffix = "") {
  return prisma.scheduleSource.create({
    data: {
      name: `City of Toronto Drop-In Apply Test${suffix}`,
      sourceType: RunSourceType.CITY,
      url: `https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/${suffix}`,
      providerKey: `toronto-drop-in${suffix}`,
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

// An already-imported Run, with its delisting counters set to whatever state a
// test needs to start from.
async function createImportedRun({
  scheduleSourceId,
  venueId,
  sourceExternalId,
  sourceStatus = SourceRunStatus.ACTIVE,
  sourceMissCount = 0,
  sourceMissingSince = null,
}: {
  scheduleSourceId: string;
  venueId: string;
  sourceExternalId: string;
  sourceStatus?: SourceRunStatus;
  sourceMissCount?: number;
  sourceMissingSince?: Date | null;
}) {
  return prisma.run.create({
    data: {
      title: "Adult Basketball",
      sourceType: RunSourceType.CITY,
      startTime: new Date("2026-07-20T22:00:00.000Z"),
      endTime: new Date("2026-07-21T00:00:00.000Z"),
      skillLevel: SkillLevel.OPEN,
      ageGroup: AgeGroup.ADULT,
      verified: true,
      sourceExternalId,
      sourceFingerprint: `${sourceExternalId}:fingerprint`,
      sourceStatus,
      sourceMissCount,
      sourceMissingSince,
      venueId,
      scheduleSourceId,
    },
  });
}

// The shape runTorontoDryRunImport produces for an in-window run that was not
// in the snapshot (see missingRunItems in src/server/importers/toronto/dry-run.ts):
// a summary payload rather than a full run payload, linked to the Run by id.
function missingItemData({
  batchId,
  run,
}: {
  batchId: string;
  run: { id: string; sourceExternalId: string | null };
}) {
  return {
    batchId,
    sourceKey: `missing-${run.sourceExternalId}`,
    sourceOccurrenceId: run.sourceExternalId,
    action: ImportItemAction.MISSING,
    reviewStatus: ImportReviewStatus.PENDING,
    runId: run.id,
    normalizedPayload: {
      kind: "missing_run",
      runId: run.id,
      title: "Adult Basketball",
      startTime: "2026-07-20T22:00:00.000Z",
      endTime: "2026-07-21T00:00:00.000Z",
      sourceExternalId: run.sourceExternalId,
      sourceSeriesId: null,
    },
    errorMessage:
      "Run was not present in this Toronto snapshot (observed window 2026-07-18..2026-08-29).",
  };
}

async function createVenue(name = "Apply Test Community Centre") {
  return prisma.venue.create({
    data: {
      name,
      addressLine1: "1 Apply Way",
      city: "Toronto",
    },
  });
}

async function createDryRunBatch(
  scheduleSourceId: string,
  overrides: {
    mode?: ImportBatchMode;
    status?: ImportBatchStatus;
    isCompleteSnapshot?: boolean;
    completedAt?: Date | null;
  } = {},
) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "test",
      mode: overrides.mode ?? ImportBatchMode.DRY_RUN,
      status: overrides.status ?? ImportBatchStatus.SUCCEEDED,
      isCompleteSnapshot: overrides.isCompleteSnapshot ?? true,
      completedAt:
        overrides.completedAt === undefined
          ? new Date("2026-07-17T12:00:00.000Z")
          : overrides.completedAt,
      dropInRecordCount: 1,
      basketballRecordCount: 1,
    },
  });
}

function runPayload({
  scheduleSourceId,
  venueId,
  sourceExternalId,
  title = "Adult Basketball",
  startTime = "2026-07-20T22:00:00.000Z",
  endTime = "2026-07-21T00:00:00.000Z",
}: {
  scheduleSourceId: string;
  venueId: string;
  sourceExternalId: string;
  title?: string;
  startTime?: string;
  endTime?: string;
}) {
  return {
    title,
    description: "Drop-in basketball from Toronto open data.",
    sourceType: RunSourceType.CITY,
    startTime,
    endTime,
    price: null,
    skillLevel: SkillLevel.OPEN,
    ageGroup: AgeGroup.ADULT,
    maxPlayers: null,
    verified: true,
    sourceUrl: "https://example.com/source",
    sourceExternalId,
    sourceSeriesId: "series-1",
    sourceFingerprint: `${sourceExternalId}:fingerprint`,
    sourceStatus: SourceRunStatus.ACTIVE,
    reviewStatus: ImportReviewStatus.PENDING,
    sourceAgeLabel: "19+",
    sourceMinAge: 19,
    sourceMaxAge: null,
    sourceFirstSeenAt: "2026-07-17T12:00:00.000Z",
    sourceLastSeenAt: "2026-07-17T12:00:00.000Z",
    venueId,
    scheduleSourceId,
  };
}

describe("applyImportBatch", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("creates runs from CREATE items and records an APPLY batch", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await createVenue();
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: {
        batchId: batch.id,
        sourceKey: "create-1",
        sourceOccurrenceId: "source-create-1",
        sourceSeriesId: "series-1",
        action: ImportItemAction.CREATE,
        reviewStatus: ImportReviewStatus.PENDING,
        normalizedPayload: runPayload({
          scheduleSourceId: scheduleSource.id,
          venueId: venue.id,
          sourceExternalId: "source-create-1",
        }),
      },
    });

    const result = await applyImportBatch(batch.id);

    expect(result.alreadyApplied).toBe(false);
    expect(result.counts).toMatchObject({
      createdCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
      errorCount: 0,
    });
    await expect(prisma.run.count()).resolves.toBe(1);
    const run = await prisma.run.findFirstOrThrow();
    expect(run).toMatchObject({
      title: "Adult Basketball",
      sourceExternalId: "source-create-1",
      sourceType: RunSourceType.CITY,
      venueId: venue.id,
      scheduleSourceId: scheduleSource.id,
      verified: true,
    });
    expect(result.affectedRunIds).toEqual([run.id]);

    await expect(
      prisma.importBatch.findUnique({
        where: {
          id: result.applyBatchId,
        },
      }),
    ).resolves.toMatchObject({
      mode: ImportBatchMode.APPLY,
      trigger: `apply:${batch.id}`,
      status: ImportBatchStatus.SUCCEEDED,
      createdCount: 1,
    });
  });

  it("updates runs from UPDATE items", async () => {
    const scheduleSource = await createScheduleSource();
    const oldVenue = await createVenue("Old Venue");
    const newVenue = await createVenue("New Venue");
    const firstSeenAt = new Date("2026-07-01T12:00:00.000Z");
    const run = await prisma.run.create({
      data: {
        title: "Old title",
        sourceType: RunSourceType.CITY,
        startTime: new Date("2026-07-20T20:00:00.000Z"),
        endTime: new Date("2026-07-20T22:00:00.000Z"),
        skillLevel: SkillLevel.BEGINNER,
        ageGroup: AgeGroup.ADULT,
        verified: false,
        sourceExternalId: "source-update-1",
        sourceFingerprint: "old-fingerprint",
        sourceFirstSeenAt: firstSeenAt,
        venueId: oldVenue.id,
        scheduleSourceId: scheduleSource.id,
      },
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: {
        batchId: batch.id,
        sourceKey: "update-1",
        sourceOccurrenceId: "source-update-1",
        sourceSeriesId: "series-1",
        action: ImportItemAction.UPDATE,
        reviewStatus: ImportReviewStatus.PENDING,
        runId: run.id,
        normalizedPayload: runPayload({
          scheduleSourceId: scheduleSource.id,
          venueId: newVenue.id,
          sourceExternalId: "source-update-1",
          title: "Updated basketball",
          startTime: "2026-07-21T22:00:00.000Z",
          endTime: "2026-07-22T00:00:00.000Z",
        }),
        fieldDiff: [
          {
            field: "title",
            current: "Old title",
            proposed: "Updated basketball",
          },
        ],
      },
    });

    const result = await applyImportBatch(batch.id);

    expect(result.counts.updatedCount).toBe(1);
    await expect(
      prisma.run.findUnique({
        where: {
          id: run.id,
        },
      }),
    ).resolves.toMatchObject({
      title: "Updated basketball",
      startTime: new Date("2026-07-21T22:00:00.000Z"),
      sourceFingerprint: "source-update-1:fingerprint",
      sourceFirstSeenAt: firstSeenAt,
      venueId: newVenue.id,
      verified: true,
    });
  });

  it("ignores unchanged, skipped, and error dry-run items", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.createMany({
      data: [
        {
          batchId: batch.id,
          sourceKey: "unchanged-1",
          action: ImportItemAction.UNCHANGED,
          reviewStatus: ImportReviewStatus.AUTO_APPROVED,
        },
        {
          batchId: batch.id,
          sourceKey: "skipped-1",
          action: ImportItemAction.SKIPPED,
          reviewStatus: ImportReviewStatus.PENDING,
          errorMessage: "Skipped by dry run.",
        },
        {
          batchId: batch.id,
          sourceKey: "error-1",
          action: ImportItemAction.ERROR,
          reviewStatus: ImportReviewStatus.PENDING,
          errorMessage: "Errored during dry run.",
        },
      ],
    });

    const result = await applyImportBatch(batch.id);

    await expect(prisma.run.count()).resolves.toBe(0);
    expect(result.counts).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      unchangedCount: 1,
      skippedCount: 1,
      errorCount: 1,
    });
  });

  it("does not duplicate runs if applied twice", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await createVenue();
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: {
        batchId: batch.id,
        sourceKey: "create-1",
        sourceOccurrenceId: "source-create-1",
        action: ImportItemAction.CREATE,
        reviewStatus: ImportReviewStatus.PENDING,
        normalizedPayload: runPayload({
          scheduleSourceId: scheduleSource.id,
          venueId: venue.id,
          sourceExternalId: "source-create-1",
        }),
      },
    });

    const first = await applyImportBatch(batch.id);
    const second = await applyImportBatch(batch.id);

    expect(second.alreadyApplied).toBe(true);
    expect(second.applyBatchId).toBe(first.applyBatchId);
    await expect(prisma.run.count()).resolves.toBe(1);
    await expect(
      prisma.importBatch.count({
        where: {
          mode: ImportBatchMode.APPLY,
          trigger: `apply:${batch.id}`,
        },
      }),
    ).resolves.toBe(1);
  });

  it("counts a first miss without delisting the run", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await createVenue();
    const run = await createImportedRun({
      scheduleSourceId: scheduleSource.id,
      venueId: venue.id,
      sourceExternalId: "source-missing-1",
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: missingItemData({ batchId: batch.id, run }),
    });

    const result = await applyImportBatch(batch.id);

    expect(result.counts.missingCount).toBe(1);
    expect(result.affectedRunIds).toEqual([run.id]);

    const updated = await prisma.run.findUniqueOrThrow({
      where: {
        id: run.id,
      },
    });

    // One miss is only an observation: the run stays ACTIVE and therefore stays
    // on the public listing.
    expect(updated.sourceStatus).toBe(SourceRunStatus.ACTIVE);
    expect(updated.sourceMissCount).toBe(1);
    expect(updated.sourceMissingSince).not.toBeNull();
  });

  it("marks a run REMOVED on the second miss and keeps the first miss timestamp", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await createVenue();
    const firstMissAt = new Date("2026-07-10T12:00:00.000Z");
    const run = await createImportedRun({
      scheduleSourceId: scheduleSource.id,
      venueId: venue.id,
      sourceExternalId: "source-missing-2",
      sourceMissCount: 1,
      sourceMissingSince: firstMissAt,
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: missingItemData({ batchId: batch.id, run }),
    });

    const result = await applyImportBatch(batch.id);

    expect(result.counts.missingCount).toBe(1);
    await expect(
      prisma.run.findUniqueOrThrow({
        where: {
          id: run.id,
        },
      }),
    ).resolves.toMatchObject({
      sourceStatus: SourceRunStatus.REMOVED,
      sourceMissCount: 2,
      // "Missing since" is the start of the absence, so the second miss must
      // not overwrite it.
      sourceMissingSince: firstMissAt,
    });
  });

  it("errors instead of delisting a run that belongs to another schedule source", async () => {
    const scheduleSource = await createScheduleSource();
    const otherScheduleSource = await createScheduleSource("-other");
    const venue = await createVenue();
    const otherSourceRun = await createImportedRun({
      scheduleSourceId: otherScheduleSource.id,
      venueId: venue.id,
      sourceExternalId: "source-missing-3",
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: missingItemData({ batchId: batch.id, run: otherSourceRun }),
    });

    const result = await applyImportBatch(batch.id);

    expect(result.counts).toMatchObject({
      missingCount: 0,
      errorCount: 1,
    });
    await expect(
      prisma.run.findUniqueOrThrow({
        where: {
          id: otherSourceRun.id,
        },
      }),
    ).resolves.toMatchObject({
      sourceStatus: SourceRunStatus.ACTIVE,
      sourceMissCount: 0,
      sourceMissingSince: null,
    });
  });

  it("does not advance the miss count for a run that is already removed", async () => {
    const scheduleSource = await createScheduleSource();
    const venue = await createVenue();
    const firstMissAt = new Date("2026-07-10T12:00:00.000Z");
    const run = await createImportedRun({
      scheduleSourceId: scheduleSource.id,
      venueId: venue.id,
      sourceExternalId: "source-missing-4",
      sourceStatus: SourceRunStatus.REMOVED,
      sourceMissCount: 2,
      sourceMissingSince: firstMissAt,
    });
    const batch = await createDryRunBatch(scheduleSource.id);
    await prisma.importItem.create({
      data: missingItemData({ batchId: batch.id, run }),
    });

    const result = await applyImportBatch(batch.id);

    expect(result.counts).toMatchObject({
      missingCount: 0,
      unchangedCount: 1,
      errorCount: 0,
    });
    await expect(
      prisma.run.findUniqueOrThrow({
        where: {
          id: run.id,
        },
      }),
    ).resolves.toMatchObject({
      sourceStatus: SourceRunStatus.REMOVED,
      sourceMissCount: 2,
      sourceMissingSince: firstMissAt,
    });
  });

  it("rejects invalid and non-dry-run batches", async () => {
    const scheduleSource = await createScheduleSource();
    const applyModeBatch = await createDryRunBatch(scheduleSource.id, {
      mode: ImportBatchMode.APPLY,
    });
    const runningBatch = await createDryRunBatch(scheduleSource.id, {
      status: ImportBatchStatus.RUNNING,
      completedAt: null,
    });

    await expect(applyImportBatch("missing-batch")).rejects.toThrow(
      ApplyImportBatchError,
    );
    await expect(applyImportBatch(applyModeBatch.id)).rejects.toThrow(
      "Only dry-run import batches can be applied.",
    );
    await expect(applyImportBatch(runningBatch.id)).rejects.toThrow(
      "Only completed dry-run import batches can be applied.",
    );
    await expect(prisma.run.count()).resolves.toBe(0);
  });
});
