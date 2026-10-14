import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  ImportBatchMode,
  ImportBatchStatus,
} from "@/generated/prisma/enums";
import { applyTriggerForBatch } from "./apply-import-batch";

type AutoApplyGatePrisma = Pick<PrismaClient, "importBatch">;

// Applying a batch by hand means a person looked at it first. Applying one from
// cron means nobody did, so the rules that a human implicitly enforces have to
// be written down. This module is that list; it decides nothing about how to
// apply a batch, only whether doing so unattended is safe.
//
// Every limit is an option with a default so a test can pin behaviour at a
// boundary without rewriting the rule. Annotated rather than `as const`,
// because literal types here would stop a caller overriding one.
export type AutoApplyLimits = {
  maxBatchAgeMs: number;
  maxMissingCount: number;
  maxMissingRatio: number;
};

export const DEFAULT_AUTO_APPLY_LIMITS: AutoApplyLimits = {
  // A batch is normally applied seconds after it is built, in the same cron
  // invocation. This bound exists for the batch that was not: one built before
  // a failure, or by hand days ago. Its MISSING items were judged against a
  // date window that has since moved, so acting on them now would delist runs
  // using evidence that is no longer current.
  maxBatchAgeMs: 24 * 60 * 60 * 1000,

  // Runs that age out of Toronto's rolling window are not reported as MISSING
  // (that is what the observed window in commit 4 is for), so in steady state
  // this count reflects genuine cancellations only and should sit near zero.
  // A large value means something went wrong upstream, not that the city
  // cancelled a season overnight.
  maxMissingCount: 100,

  // The same guard in proportional form, which catches a truncated or partial
  // feed on a source far smaller or larger than Toronto's.
  maxMissingRatio: 0.25,
};

export type AutoApplyBlockerCode =
  | "NOT_DRY_RUN"
  | "NOT_COMPLETED"
  | "UNUSABLE_STATUS"
  | "INCOMPLETE_SNAPSHOT"
  | "HAS_ERRORS"
  | "ALREADY_APPLIED"
  | "BATCH_TOO_OLD"
  | "TOO_MANY_MISSING";

export type AutoApplyBlocker = {
  code: AutoApplyBlockerCode;
  message: string;
};

export type AutoApplyCandidateBatch = {
  id: string;
  mode: ImportBatchMode;
  status: ImportBatchStatus;
  isCompleteSnapshot: boolean;
  completedAt: Date | null;
  updatedCount: number;
  unchangedCount: number;
  missingCount: number;
  errorCount: number;
  appliedBatchId: string | null;
};

export type AutoApplyEvaluation = {
  canAutoApply: boolean;
  blockers: AutoApplyBlocker[];
  missingCount: number;
  knownRunCount: number;
  missingRatio: number;
};

// Of the runs this snapshot had something to say about, how many did we already
// know? MISSING is window-scoped while UPDATE and UNCHANGED are not, so this is
// a sanity denominator rather than an exact population - enough to tell "three
// cancellations" from "the feed came back empty".
function knownRunCountOf(batch: AutoApplyCandidateBatch): number {
  return batch.updatedCount + batch.unchangedCount + batch.missingCount;
}

export function evaluateAutoApply(
  batch: AutoApplyCandidateBatch,
  options: {
    now?: Date;
    limits?: Partial<AutoApplyLimits>;
  } = {},
): AutoApplyEvaluation {
  const limits = { ...DEFAULT_AUTO_APPLY_LIMITS, ...options.limits };
  const now = options.now ?? new Date();
  const blockers: AutoApplyBlocker[] = [];

  const knownRunCount = knownRunCountOf(batch);
  const missingRatio =
    knownRunCount > 0 ? batch.missingCount / knownRunCount : 0;

  // The first four mirror assertDryRunBatchCanApply, which throws. Here they
  // have to be reportable instead: cron needs to log why it declined, and a
  // thrown error from a routine "not ready yet" would read as a failure.
  if (batch.mode !== ImportBatchMode.DRY_RUN) {
    blockers.push({
      code: "NOT_DRY_RUN",
      message: `Batch mode is ${batch.mode}; only dry-run batches can be applied.`,
    });
  }

  if (!batch.completedAt) {
    blockers.push({
      code: "NOT_COMPLETED",
      message: "Batch has not finished running.",
    });
  }

  if (
    batch.status !== ImportBatchStatus.SUCCEEDED &&
    batch.status !== ImportBatchStatus.PARTIAL
  ) {
    blockers.push({
      code: "UNUSABLE_STATUS",
      message: `Batch status is ${batch.status}; only succeeded or partial batches can be applied.`,
    });
  }

  if (!batch.isCompleteSnapshot) {
    blockers.push({
      code: "INCOMPLETE_SNAPSHOT",
      message:
        "Batch was built from an incomplete snapshot, so absences in it cannot be trusted.",
    });
  }

  // A human can look at an error, decide it is unrelated to what they are
  // applying, and proceed anyway. Unattended, there is nobody to make that
  // call, so any error holds the batch for review. Skipped items are different
  // and deliberately do not block: unmatched venues are an expected steady
  // state, and blocking on them would mean auto-apply never runs at all.
  if (batch.errorCount > 0) {
    blockers.push({
      code: "HAS_ERRORS",
      message: `Batch has ${batch.errorCount} error item(s), which need review before applying.`,
    });
  }

  if (batch.appliedBatchId) {
    blockers.push({
      code: "ALREADY_APPLIED",
      message: `Batch was already applied by batch ${batch.appliedBatchId}.`,
    });
  }

  if (batch.completedAt) {
    const ageMs = now.getTime() - batch.completedAt.getTime();

    if (ageMs > limits.maxBatchAgeMs) {
      blockers.push({
        code: "BATCH_TOO_OLD",
        message: `Batch finished ${Math.round(ageMs / 3_600_000)}h ago, past the ${Math.round(limits.maxBatchAgeMs / 3_600_000)}h auto-apply limit.`,
      });
    }
  }

  if (batch.missingCount > limits.maxMissingCount) {
    blockers.push({
      code: "TOO_MANY_MISSING",
      message: `Batch would record ${batch.missingCount} missing runs, over the limit of ${limits.maxMissingCount}.`,
    });
  } else if (missingRatio > limits.maxMissingRatio) {
    blockers.push({
      code: "TOO_MANY_MISSING",
      message: `Batch would record ${batch.missingCount} of ${knownRunCount} known runs as missing (${Math.round(missingRatio * 100)}%), over the limit of ${Math.round(limits.maxMissingRatio * 100)}%.`,
    });
  }

  return {
    canAutoApply: blockers.length === 0,
    blockers,
    missingCount: batch.missingCount,
    knownRunCount,
    missingRatio,
  };
}

export async function evaluateAutoApplyForBatch(
  db: AutoApplyGatePrisma,
  batchId: string,
  options: {
    now?: Date;
    limits?: Partial<AutoApplyLimits>;
  } = {},
): Promise<AutoApplyEvaluation | null> {
  const batch = await db.importBatch.findUnique({
    where: {
      id: batchId,
    },
    select: {
      id: true,
      scheduleSourceId: true,
      mode: true,
      status: true,
      isCompleteSnapshot: true,
      completedAt: true,
      updatedCount: true,
      unchangedCount: true,
      missingCount: true,
      errorCount: true,
    },
  });

  if (!batch) {
    return null;
  }

  // applyImportBatch is idempotent on this trigger, so an existing apply batch
  // is the same signal it uses to refuse doing the work twice.
  const appliedBatch = await db.importBatch.findFirst({
    where: {
      scheduleSourceId: batch.scheduleSourceId,
      mode: ImportBatchMode.APPLY,
      trigger: applyTriggerForBatch(batch.id),
    },
    select: {
      id: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  return evaluateAutoApply(
    {
      ...batch,
      appliedBatchId: appliedBatch?.id ?? null,
    },
    options,
  );
}
