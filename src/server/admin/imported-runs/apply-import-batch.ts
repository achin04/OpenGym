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

// Prisma's interactive-transaction default is 5s (prismaNamespace.ts:
// `timeout ?= 5000`), sized for a handful of queries. This transaction does
// two DB round trips per CREATE/UPDATE item (write the Run, then link the
// dry-run ImportItem to it) and a batch can hold over a thousand items, so
// against real network latency the default would abort on the very first
// production run. 120s gives real headroom without disabling the timeout
// outright - a genuinely stuck apply should still fail loudly rather than
// hang forever.
const APPLY_TRANSACTION_TIMEOUT_MS = 120_000;

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

// Existing Run rows for the batch's schedule source, keyed by sourceExternalId.
// Loaded once before the item loop so CREATE items can check "does a run for
// this source occurrence already exist?" without a per-item query - mirroring
// the same hoisted-lookup pattern the dry-run step already uses (dry-run.ts,
// `existingRunsByExternalId`).
type ExistingRunByExternalId = Map<string, { id: string }>;

// Existing Run rows targeted by this batch's UPDATE items, keyed by run id.
// Loaded once before the item loop for the same reason.
type ExistingRunById = Map<
  string,
  {
    id: string;
    scheduleSourceId: string | null;
    sourceExternalId: string | null;
    sourceFirstSeenAt: Date | null;
  }
>;

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

// Loads everything applyCreateItem/applyUpdateItem need to know about
// pre-existing rows, in a fixed number of queries instead of a handful per
// item. All three reads are scoped as tightly as the per-item lookups they
// replace: runsForSource only pulls this batch's own schedule source, and
// the update/venue lookups only pull the ids this batch actually references.
async function preloadApplyContext(
  db: ApplyImportBatchTransaction,
  batch: DryRunBatch,
): Promise<{
  existingRunsByExternalId: ExistingRunByExternalId;
  existingRunsById: ExistingRunById;
  existingVenueIds: Set<string>;
}> {
  const updateRunIds = Array.from(
    new Set(
      batch.items.flatMap((item) =>
        item.action === ImportItemAction.UPDATE && item.runId
          ? [item.runId]
          : [],
      ),
    ),
  );

  const venueIds = new Set<string>();
  for (const item of batch.items) {
    if (
      item.action !== ImportItemAction.CREATE &&
      item.action !== ImportItemAction.UPDATE
    ) {
      continue;
    }

    const parsed = parseImportRunApplyPayload(item.normalizedPayload);
    if (parsed.success) {
      venueIds.add(parsed.data.venueId);
    }
  }

  const runsForSource = await db.run.findMany({
    where: {
      scheduleSourceId: batch.scheduleSourceId,
    },
    select: {
      id: true,
      sourceExternalId: true,
    },
  });

  const runsById =
    updateRunIds.length > 0
      ? await db.run.findMany({
          where: {
            id: { in: updateRunIds },
          },
          select: {
            id: true,
            scheduleSourceId: true,
            sourceExternalId: true,
            sourceFirstSeenAt: true,
          },
        })
      : [];

  const venues =
    venueIds.size > 0
      ? await db.venue.findMany({
          where: {
            id: { in: Array.from(venueIds) },
          },
          select: {
            id: true,
          },
        })
      : [];

  const existingRunsByExternalId: ExistingRunByExternalId = new Map();
  for (const run of runsForSource) {
    if (run.sourceExternalId) {
      existingRunsByExternalId.set(run.sourceExternalId, { id: run.id });
    }
  }

  return {
    existingRunsByExternalId,
    existingRunsById: new Map(runsById.map((run) => [run.id, run])),
    existingVenueIds: new Set(venues.map((venue) => venue.id)),
  };
}

async function applyCreateItem({
  db,
  batch,
  item,
  existingRunsByExternalId,
  existingVenueIds,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
  existingRunsByExternalId: ExistingRunByExternalId;
  existingVenueIds: Set<string>;
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

  const existingRun = existingRunsByExternalId.get(parsed.data.sourceExternalId);

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

  if (!existingVenueIds.has(parsed.data.venueId)) {
    return errorItem(item, `Venue ${parsed.data.venueId} was not found.`);
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
  existingRunsById,
  existingVenueIds,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
  existingRunsById: ExistingRunById;
  existingVenueIds: Set<string>;
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

  const existingRun = existingRunsById.get(item.runId);

  if (!existingRun) {
    return errorItem(item, "Update item target Run was not found.");
  }

  if (
    existingRun.scheduleSourceId !== parsed.data.scheduleSourceId ||
    existingRun.sourceExternalId !== parsed.data.sourceExternalId
  ) {
    return errorItem(item, "Update item target Run does not match its source.");
  }

  if (!existingVenueIds.has(parsed.data.venueId)) {
    return errorItem(item, `Venue ${parsed.data.venueId} was not found.`);
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
  existingRunsByExternalId,
  existingRunsById,
  existingVenueIds,
}: {
  db: ApplyImportBatchTransaction;
  batch: DryRunBatch;
  item: DryRunImportItem;
  existingRunsByExternalId: ExistingRunByExternalId;
  existingRunsById: ExistingRunById;
  existingVenueIds: Set<string>;
}): Promise<ApplyImportItemDraft> {
  if (item.action === ImportItemAction.CREATE) {
    return applyCreateItem({
      db,
      batch,
      item,
      existingRunsByExternalId,
      existingVenueIds,
    });
  }

  if (item.action === ImportItemAction.UPDATE) {
    return applyUpdateItem({ db, batch, item, existingRunsById, existingVenueIds });
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
  return db.$transaction(
    async (tx) => {
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
          dropInResourceLastModifiedAt:
            dryRunBatch.dropInResourceLastModifiedAt,
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

      const { existingRunsByExternalId, existingRunsById, existingVenueIds } =
        await preloadApplyContext(tx, dryRunBatch);

      const applyItems: ApplyImportItemDraft[] = [];

      for (const item of dryRunBatch.items) {
        applyItems.push(
          await applyDryRunItem({
            db: tx,
            batch: dryRunBatch,
            item,
            existingRunsByExternalId,
            existingRunsById,
            existingVenueIds,
          }),
        );
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
    },
    {
      timeout: APPLY_TRANSACTION_TIMEOUT_MS,
    },
  );
}
