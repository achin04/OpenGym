import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  ImportBatchMode,
  ImportBatchStatus,
  ImportItemAction,
  ImportReviewStatus,
} from "@/generated/prisma/enums";
import { parseImportRunApplyPayload } from "@/lib/admin/imported-runs/apply-payload-parsing";
import type { ImportRunApplyPayload } from "@/lib/admin/imported-runs/apply-payload-parsing";
import { prisma as defaultPrisma } from "@/server/db";

const APPLY_TRIGGER_PREFIX = "apply:";

type ApplyImportBatchPrisma = Pick<
  PrismaClient,
  "$transaction" | "importBatch" | "importItem" | "run" | "venue"
>;

type ApplyImportBatchTransaction = Pick<
  PrismaClient,
  "importBatch" | "importItem" | "run" | "venue"
>;

type DryRunBatch = NonNullable<
  Awaited<ReturnType<typeof findDryRunBatchForApply>>
>;

type DryRunImportItem = DryRunBatch["items"][number];

type ApplyImportItemDraft = {
  sourceKey: string;
  sourceOccurrenceId: string | null;
  sourceSeriesId: string | null;
  action: (typeof ImportItemAction)[keyof typeof ImportItemAction];
  reviewStatus: (typeof ImportReviewStatus)[keyof typeof ImportReviewStatus];
  runId: string | null;
  rawPayload: unknown;
  normalizedPayload: unknown;
  fieldDiff: unknown;
  errorMessage: string | null;
};

export type ApplyImportBatchResult = {
  dryRunBatchId: string;
  applyBatchId: string;
  alreadyApplied: boolean;
  affectedRunIds: string[];
  counts: {
    createdCount: number;
    updatedCount: number;
    unchangedCount: number;
    missingCount: number;
    skippedCount: number;
    errorCount: number;
  };
};

export class ApplyImportBatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplyImportBatchError";
  }
}

function fail(message: string): never {
  throw new ApplyImportBatchError(message);
}

function applyTriggerForBatch(batchId: string) {
  return `${APPLY_TRIGGER_PREFIX}${batchId}`;
}

function summarizeApplyItems(items: ApplyImportItemDraft[]) {
  return {
    createdCount: items.filter((item) => item.action === ImportItemAction.CREATE)
      .length,
    updatedCount: items.filter((item) => item.action === ImportItemAction.UPDATE)
      .length,
    unchangedCount: items.filter(
      (item) => item.action === ImportItemAction.UNCHANGED,
    ).length,
    missingCount: items.filter((item) => item.action === ImportItemAction.MISSING)
      .length,
    skippedCount: items.filter((item) => item.action === ImportItemAction.SKIPPED)
      .length,
    errorCount: items.filter((item) => item.action === ImportItemAction.ERROR)
      .length,
  };
}

function resultFromApplyBatch(
  dryRunBatchId: string,
  applyBatch: {
    id: string;
    createdCount: number;
    updatedCount: number;
    unchangedCount: number;
    missingCount: number;
    skippedCount: number;
    errorCount: number;
    items: { runId: string | null }[];
  },
  alreadyApplied: boolean,
): ApplyImportBatchResult {
  return {
    dryRunBatchId,
    applyBatchId: applyBatch.id,
    alreadyApplied,
    affectedRunIds: Array.from(
      new Set(
        applyBatch.items.flatMap((item) => (item.runId ? [item.runId] : [])),
      ),
    ).sort(),
    counts: {
      createdCount: applyBatch.createdCount,
      updatedCount: applyBatch.updatedCount,
      unchangedCount: applyBatch.unchangedCount,
      missingCount: applyBatch.missingCount,
      skippedCount: applyBatch.skippedCount,
      errorCount: applyBatch.errorCount,
    },
  };
}

async function findExistingApplyBatch(
  db: ApplyImportBatchTransaction,
  dryRunBatch: DryRunBatch,
) {
  return db.importBatch.findFirst({
    where: {
      scheduleSourceId: dryRunBatch.scheduleSourceId,
      mode: ImportBatchMode.APPLY,
      trigger: applyTriggerForBatch(dryRunBatch.id),
    },
    include: {
      items: {
        select: {
          runId: true,
        },
      },
    },
    orderBy: {
      startedAt: "asc",
    },
  });
}

async function findDryRunBatchForApply(
  db: ApplyImportBatchTransaction,
  batchId: string,
) {
  return db.importBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      items: {
        orderBy: {
          sourceKey: "asc",
        },
      },
    },
  });
}

function assertDryRunBatchCanApply(
  batch: DryRunBatch | null,
): asserts batch is DryRunBatch {
  if (!batch) {
    fail("Import batch was not found.");
  }

  if (batch.mode !== ImportBatchMode.DRY_RUN) {
    fail("Only dry-run import batches can be applied.");
  }

  if (!batch.completedAt) {
    fail("Only completed dry-run import batches can be applied.");
  }

  if (
    batch.status !== ImportBatchStatus.SUCCEEDED &&
    batch.status !== ImportBatchStatus.PARTIAL
  ) {
    fail("Only succeeded or partial dry-run import batches can be applied.");
  }

  if (!batch.isCompleteSnapshot) {
    fail("Only complete dry-run snapshots can be applied.");
  }
}

function errorItem(item: DryRunImportItem, message: string): ApplyImportItemDraft {
  return {
    sourceKey: item.sourceKey,
    sourceOccurrenceId: item.sourceOccurrenceId,
    sourceSeriesId: item.sourceSeriesId,
    action: ImportItemAction.ERROR,
    reviewStatus: ImportReviewStatus.PENDING,
    runId: item.runId,
    rawPayload: item.rawPayload,
    normalizedPayload: item.normalizedPayload,
    fieldDiff: item.fieldDiff,
    errorMessage: message,
  };
}

function skippedAuditItem(item: DryRunImportItem): ApplyImportItemDraft {
  return {
    sourceKey: item.sourceKey,
    sourceOccurrenceId: item.sourceOccurrenceId,
    sourceSeriesId: item.sourceSeriesId,
    action: item.action,
    reviewStatus: item.reviewStatus,
    runId: item.runId,
    rawPayload: item.rawPayload,
    normalizedPayload: item.normalizedPayload,
    fieldDiff: item.fieldDiff,
    errorMessage: item.errorMessage,
  };
}

function runDataFromPayload(
  payload: ImportRunApplyPayload,
  sourceFirstSeenAt: Date | null | undefined,
) {
  return {
    title: payload.title,
    description: payload.description ?? null,
    sourceType: payload.sourceType,
    startTime: payload.startTime,
    endTime: payload.endTime,
    price: payload.price,
    skillLevel: payload.skillLevel,
    ageGroup: payload.ageGroup,
    maxPlayers: payload.maxPlayers ?? null,
    verified: payload.verified,
    sourceUrl: payload.sourceUrl ?? null,
    sourceExternalId: payload.sourceExternalId,
    sourceSeriesId: payload.sourceSeriesId ?? null,
    sourceFingerprint: payload.sourceFingerprint,
    sourceStatus: payload.sourceStatus,
    reviewStatus: payload.reviewStatus,
    sourceAgeLabel: payload.sourceAgeLabel ?? null,
    sourceMinAge: payload.sourceMinAge ?? null,
    sourceMaxAge: payload.sourceMaxAge ?? null,
    sourceFirstSeenAt: sourceFirstSeenAt ?? payload.sourceFirstSeenAt ?? null,
    sourceLastSeenAt: payload.sourceLastSeenAt ?? null,
    sourceMissingSince: null,
    sourceMissCount: 0,
    venueId: payload.venueId,
    scheduleSourceId: payload.scheduleSourceId,
  };
}

async function assertVenueExists(
  db: ApplyImportBatchTransaction,
  venueId: string,
) {
  const venue = await db.venue.findUnique({
    where: {
      id: venueId,
    },
    select: {
      id: true,
    },
  });

  if (!venue) {
    fail(`Venue ${venueId} was not found.`);
  }
}

async function applyCreateItem({
  db,
  batch,
  item,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
}): Promise<ApplyImportItemDraft> {
  const parsed = parseImportRunApplyPayload(item.normalizedPayload);

  if (!parsed.success) {
    return errorItem(item, "Import item has an invalid run payload.");
  }

  if (parsed.data.scheduleSourceId !== batch.scheduleSourceId) {
    return errorItem(
      item,
      "Import item belongs to a different schedule source.",
    );
  }

  const existingRun = await db.run.findUnique({
    where: {
      scheduleSourceId_sourceExternalId: {
        scheduleSourceId: parsed.data.scheduleSourceId,
        sourceExternalId: parsed.data.sourceExternalId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingRun) {
    await db.importItem.update({
      where: {
        id: item.id,
      },
      data: {
        runId: existingRun.id,
      },
    });

    return {
      ...skippedAuditItem(item),
      action: ImportItemAction.UNCHANGED,
      reviewStatus: ImportReviewStatus.AUTO_APPROVED,
      runId: existingRun.id,
      errorMessage: "Run already exists for this source occurrence.",
    };
  }

  try {
    await assertVenueExists(db, parsed.data.venueId);
  } catch (error) {
    return error instanceof ApplyImportBatchError
      ? errorItem(item, error.message)
      : errorItem(item, "Import item venue could not be validated.");
  }

  const createdRun = await db.run.create({
    data: runDataFromPayload(parsed.data, parsed.data.sourceFirstSeenAt),
    select: {
      id: true,
    },
  });

  await db.importItem.update({
    where: {
      id: item.id,
    },
    data: {
      runId: createdRun.id,
    },
  });

  return {
    ...skippedAuditItem(item),
    action: ImportItemAction.CREATE,
    reviewStatus: ImportReviewStatus.AUTO_APPROVED,
    runId: createdRun.id,
    errorMessage: null,
  };
}

async function applyUpdateItem({
  db,
  batch,
  item,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
}): Promise<ApplyImportItemDraft> {
  const parsed = parseImportRunApplyPayload(item.normalizedPayload);

  if (!parsed.success) {
    return errorItem(item, "Import item has an invalid run payload.");
  }

  if (parsed.data.scheduleSourceId !== batch.scheduleSourceId) {
    return errorItem(
      item,
      "Import item belongs to a different schedule source.",
    );
  }

  if (!item.runId) {
    return errorItem(item, "Update item is missing its target Run.");
  }

  const existingRun = await db.run.findUnique({
    where: {
      id: item.runId,
    },
    select: {
      id: true,
      scheduleSourceId: true,
      sourceExternalId: true,
      sourceFirstSeenAt: true,
    },
  });

  if (!existingRun) {
    return errorItem(item, "Update item target Run was not found.");
  }

  if (
    existingRun.scheduleSourceId !== parsed.data.scheduleSourceId ||
    existingRun.sourceExternalId !== parsed.data.sourceExternalId
  ) {
    return errorItem(item, "Update item target Run does not match its source.");
  }

  try {
    await assertVenueExists(db, parsed.data.venueId);
  } catch (error) {
    return error instanceof ApplyImportBatchError
      ? errorItem(item, error.message)
      : errorItem(item, "Import item venue could not be validated.");
  }

  const updatedRun = await db.run.update({
    where: {
      id: existingRun.id,
    },
    data: runDataFromPayload(parsed.data, existingRun.sourceFirstSeenAt),
    select: {
      id: true,
    },
  });

  await db.importItem.update({
    where: {
      id: item.id,
    },
    data: {
      runId: updatedRun.id,
    },
  });

  return {
    ...skippedAuditItem(item),
    action: ImportItemAction.UPDATE,
    reviewStatus: ImportReviewStatus.AUTO_APPROVED,
    runId: updatedRun.id,
    errorMessage: null,
  };
}

async function applyDryRunItem({
  db,
  batch,
  item,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
}): Promise<ApplyImportItemDraft> {
  if (item.action === ImportItemAction.CREATE) {
    return applyCreateItem({ db, batch, item });
  }

  if (item.action === ImportItemAction.UPDATE) {
    return applyUpdateItem({ db, batch, item });
  }

  return skippedAuditItem(item);
}

function buildErrorSummary(items: ApplyImportItemDraft[]) {
  const messages = items.flatMap((item) => {
    return item.action === ImportItemAction.ERROR && item.errorMessage
      ? [item.errorMessage]
      : [];
  });

  return messages.length > 0 ? messages.slice(0, 5).join(" | ") : null;
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  return value === null ? undefined : (value as Prisma.InputJsonValue);
}

export async function applyImportBatch(
  batchId: string,
  db: ApplyImportBatchPrisma = defaultPrisma,
): Promise<ApplyImportBatchResult> {
  return db.$transaction(async (tx) => {
    const dryRunBatch = await findDryRunBatchForApply(tx, batchId);

    assertDryRunBatchCanApply(dryRunBatch);

    const existingApplyBatch = await findExistingApplyBatch(tx, dryRunBatch);

    if (existingApplyBatch) {
      return resultFromApplyBatch(batchId, existingApplyBatch, true);
    }

    const startedAt = new Date();
    const applyBatch = await tx.importBatch.create({
      data: {
        scheduleSourceId: dryRunBatch.scheduleSourceId,
        trigger: applyTriggerForBatch(dryRunBatch.id),
        mode: ImportBatchMode.APPLY,
        status: ImportBatchStatus.RUNNING,
        isCompleteSnapshot: dryRunBatch.isCompleteSnapshot,
        dropInResourceId: dryRunBatch.dropInResourceId,
        locationsResourceId: dryRunBatch.locationsResourceId,
        facilitiesResourceId: dryRunBatch.facilitiesResourceId,
        dropInResourceLastModifiedAt: dryRunBatch.dropInResourceLastModifiedAt,
        locationsResourceLastModifiedAt:
          dryRunBatch.locationsResourceLastModifiedAt,
        facilitiesResourceLastModifiedAt:
          dryRunBatch.facilitiesResourceLastModifiedAt,
        snapshotHash: dryRunBatch.snapshotHash,
        startedAt,
        dropInRecordCount: dryRunBatch.dropInRecordCount,
        locationsRecordCount: dryRunBatch.locationsRecordCount,
        facilitiesRecordCount: dryRunBatch.facilitiesRecordCount,
        basketballRecordCount: dryRunBatch.basketballRecordCount,
      },
      select: {
        id: true,
      },
    });

    const applyItems: ApplyImportItemDraft[] = [];

    for (const item of dryRunBatch.items) {
      applyItems.push(await applyDryRunItem({ db: tx, batch: dryRunBatch, item }));
    }

    if (applyItems.length > 0) {
      await tx.importItem.createMany({
        data: applyItems.map((item) => ({
          batchId: applyBatch.id,
          sourceKey: item.sourceKey,
          sourceOccurrenceId: item.sourceOccurrenceId,
          sourceSeriesId: item.sourceSeriesId,
          action: item.action,
          reviewStatus: item.reviewStatus,
          runId: item.runId,
          rawPayload: jsonInput(item.rawPayload),
          normalizedPayload: jsonInput(item.normalizedPayload),
          fieldDiff: jsonInput(item.fieldDiff),
          errorMessage: item.errorMessage,
        })),
      });
    }

    const counts = summarizeApplyItems(applyItems);
    const completedApplyBatch = await tx.importBatch.update({
      where: {
        id: applyBatch.id,
      },
      data: {
        status:
          counts.errorCount > 0 || counts.skippedCount > 0
            ? ImportBatchStatus.PARTIAL
            : ImportBatchStatus.SUCCEEDED,
        completedAt: new Date(),
        createdCount: counts.createdCount,
        updatedCount: counts.updatedCount,
        unchangedCount: counts.unchangedCount,
        missingCount: counts.missingCount,
        skippedCount: counts.skippedCount,
        errorCount: counts.errorCount,
        errorSummary: buildErrorSummary(applyItems),
      },
      include: {
        items: {
          select: {
            runId: true,
          },
        },
      },
    });

    return resultFromApplyBatch(batchId, completedApplyBatch, false);
  });
}
