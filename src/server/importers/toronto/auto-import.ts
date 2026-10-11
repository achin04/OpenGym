import "server-only";

import {
  applyImportBatch,
  type ApplyImportBatchResult,
} from "@/server/admin/imported-runs/apply-import-batch";
import {
  evaluateAutoApplyForBatch,
  type AutoApplyEvaluation,
  type AutoApplyLimits,
} from "@/server/admin/imported-runs/auto-apply-gate";
import { prisma as defaultPrisma } from "@/server/db";
import { createTorontoCkanClient, type TorontoCkanClient } from "./ckan";
import {
  findTorontoScheduleSource,
  runTorontoDryRunImport,
  type TorontoDryRunImportSummary,
  type TorontoDryRunPrisma,
} from "./dry-run";
import { detectTorontoRefresh, type TorontoRefreshDetection } from "./refresh";

// The whole feature, composed: notice that Toronto published new data, read it
// into a reviewable batch, decide whether applying it unattended is safe, and
// apply it if so. Each of those four steps already exists and is tested on its
// own; this module only orders them and reports what happened.
//
// It lives here rather than in the route handler so the sequence can be tested
// against a real database without going through HTTP, and so the handler has
// nothing in it but authentication and serialization.

export type TorontoAutoImportStatus =
  // The source has not changed since the last batch we trust, so no work was
  // done. This is the expected outcome on six of every seven daily runs.
  | "SKIPPED_NO_REFRESH"
  // A batch was built and applied.
  | "IMPORTED_AND_APPLIED"
  // A batch was built but the gate declined to apply it unattended. The batch
  // is waiting in the admin UI, which is the designed fallback, not a failure.
  | "IMPORTED_HELD_FOR_REVIEW";

export type TorontoAutoImportResult = {
  status: TorontoAutoImportStatus;
  scheduleSourceId: string;
  refresh: TorontoRefreshDetection;
  dryRun: TorontoDryRunImportSummary | null;
  gate: AutoApplyEvaluation | null;
  apply: ApplyImportBatchResult | null;
};

export type RunTorontoAutoImportOptions = {
  db?: TorontoDryRunPrisma;
  ckanClient?: TorontoCkanClient;
  trigger?: string;
  now?: Date;
  limits?: Partial<AutoApplyLimits>;
};

export async function runTorontoAutoImport({
  db = defaultPrisma,
  ckanClient = createTorontoCkanClient(),
  trigger,
  now = new Date(),
  limits,
}: RunTorontoAutoImportOptions = {}): Promise<TorontoAutoImportResult> {
  // Throws when the schedule source row is missing, which is a setup problem
  // rather than a run-time condition, so it is not modelled as an outcome.
  const scheduleSource = await findTorontoScheduleSource(db);

  const refresh = await detectTorontoRefresh({
    db,
    scheduleSourceId: scheduleSource.id,
    client: ckanClient,
  });

  if (!refresh.hasRefreshed) {
    return {
      status: "SKIPPED_NO_REFRESH",
      scheduleSourceId: scheduleSource.id,
      refresh,
      dryRun: null,
      gate: null,
      apply: null,
    };
  }

  const dryRun = await runTorontoDryRunImport({
    db,
    ckanClient,
    trigger: trigger ?? `auto:${now.toISOString()}`,
    now,
  });

  // Evaluated with the same `now` the dry run used, so the age rule measures
  // the batch against this invocation rather than against wall-clock drift.
  const gate = await evaluateAutoApplyForBatch(db, dryRun.batchId, {
    now,
    limits,
  });

  if (!gate?.canAutoApply) {
    return {
      status: "IMPORTED_HELD_FOR_REVIEW",
      scheduleSourceId: scheduleSource.id,
      refresh,
      dryRun,
      gate,
      apply: null,
    };
  }

  const apply = await applyImportBatch(dryRun.batchId, db);

  return {
    status: "IMPORTED_AND_APPLIED",
    scheduleSourceId: scheduleSource.id,
    refresh,
    dryRun,
    gate,
    apply,
  };
}
