import "server-only";

import { ImportBatchMode } from "@/generated/prisma/enums";
import {
  applyImportBatch,
  applyTriggerForBatch,
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

// How long a claimed lease stays valid. Comfortably longer than the 300s
// function ceiling, so a run cannot outlive its own lease, but short enough
// that a crashed run stops blocking imports within one cron cycle.
const IMPORT_LEASE_MS = 15 * 60 * 1000;

export type TorontoAutoImportStatus =
  // A batch built by an earlier run was applied. Without this the pipeline
  // cannot recover from a failed apply: the dry run records the source
  // timestamps it read, so the next run's refresh detection reports UNCHANGED
  // and skips, leaving a gate-approved batch waiting forever.
  | "APPLIED_PENDING_BATCH"
  // Another import is already in flight, so this one did nothing. Vercel fires
  // this cron once a day and a run cannot exceed 300s, so scheduled runs can
  // never collide with each other; what this guards is a manual trigger landing
  // on top of a scheduled one, or an admin applying a batch by hand mid-run.
  | "SKIPPED_LOCKED"
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
  // True when the applied batch was built by an earlier invocation rather than
  // by this one.
  recoveredPendingBatch?: boolean;
  scheduleSourceId: string;
  // Null when the lease could not be claimed, because detection never ran.
  refresh: TorontoRefreshDetection | null;
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

// The newest completed dry run that was never applied. Only the newest is
// considered: an older one has necessarily been superseded, and the gate's age
// limit would reject it anyway because the date window it judged absences
// against has since moved.
async function findLatestUnappliedDryRun(
  db: TorontoDryRunPrisma,
  scheduleSourceId: string,
): Promise<string | null> {
  const latest = await db.importBatch.findFirst({
    where: {
      scheduleSourceId,
      mode: ImportBatchMode.DRY_RUN,
      completedAt: {
        not: null,
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!latest) {
    return null;
  }

  const applied = await db.importBatch.findFirst({
    where: {
      scheduleSourceId,
      mode: ImportBatchMode.APPLY,
      trigger: applyTriggerForBatch(latest.id),
    },
    select: {
      id: true,
    },
  });

  return applied ? null : latest.id;
}

// Claimed with a single conditional UPDATE, which is what makes it atomic: two
// callers racing here both lock the row, and only one sees a matching WHERE.
//
// A Postgres advisory lock would be the more obvious tool, but not a usable
// one. Session-scoped advisory locks live on a connection, and this runs
// through a pooled connection where consecutive queries may land on different
// backends, so the lock could be taken on one connection and silently absent
// on the next. Transaction-scoped ones release at commit, while this flow spans
// several transactions and two HTTP fetches. A lease row is held by the row,
// not the connection, and is visible in the database when something goes wrong.
//
// Returns the expiry it wrote, which doubles as a fencing token for release.
// Marks the last time imported data actually reached the site, which is a
// narrower claim than "the last time cron ran without error" - a skip is a
// healthy outcome but publishes nothing.
async function recordSuccessfulImport(
  db: TorontoDryRunPrisma,
  scheduleSourceId: string,
  now: Date,
): Promise<void> {
  await db.scheduleSource.update({
    where: {
      id: scheduleSourceId,
    },
    data: {
      lastSuccessfulImportAt: new Date(now),
    },
  });
}

async function claimImportLease(
  db: TorontoDryRunPrisma,
  scheduleSourceId: string,
  now: Date,
): Promise<Date | null> {
  const expiresAt = new Date(now.getTime() + IMPORT_LEASE_MS);
  const claimed = await db.scheduleSource.updateMany({
    where: {
      id: scheduleSourceId,
      OR: [
        { importLeaseExpiresAt: null },
        { importLeaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      importLeaseExpiresAt: expiresAt,
    },
  });

  return claimed.count === 1 ? expiresAt : null;
}

// Matching on the expiry we wrote means a run whose lease already expired and
// was claimed by someone else cannot release the new holder's lease.
async function releaseImportLease(
  db: TorontoDryRunPrisma,
  scheduleSourceId: string,
  expiresAt: Date,
): Promise<void> {
  await db.scheduleSource.updateMany({
    where: {
      id: scheduleSourceId,
      importLeaseExpiresAt: expiresAt,
    },
    data: {
      importLeaseExpiresAt: null,
    },
  });
}

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
  const lease = await claimImportLease(db, scheduleSource.id, now);

  if (!lease) {
    return {
      status: "SKIPPED_LOCKED",
      scheduleSourceId: scheduleSource.id,
      refresh: null,
      dryRun: null,
      gate: null,
      apply: null,
    };
  }

  try {
    // Checked before refresh detection, not after, because detection is exactly
    // what hides this case: a pending batch recorded the source state it read,
    // so the source now looks unchanged and the run would skip.
    //
    // The gate decides whether the pending batch may be applied, so nothing new
    // is being judged here. A batch holding errors is refused for the same
    // reason it was refused the first time, and one older than the age limit is
    // refused because its observed window has moved on; both then fall through
    // and keep waiting in the admin UI, which is where a person is meant to
    // deal with them.
    const pendingBatchId = await findLatestUnappliedDryRun(
      db,
      scheduleSource.id,
    );

    if (pendingBatchId) {
      const pendingGate = await evaluateAutoApplyForBatch(db, pendingBatchId, {
        now,
        limits,
      });

      if (pendingGate?.canAutoApply) {
        const apply = await applyImportBatch(pendingBatchId, db);
        await recordSuccessfulImport(db, scheduleSource.id, now);

        // Returns rather than continuing to detection: one unit of heavy work
        // per invocation keeps this well inside the function time limit, and a
        // source that has also refreshed is picked up by the next run.
        return {
          status: "APPLIED_PENDING_BATCH",
          recoveredPendingBatch: true,
          scheduleSourceId: scheduleSource.id,
          refresh: null,
          dryRun: null,
          gate: pendingGate,
          apply,
        };
      }
    }

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

    await recordSuccessfulImport(db, scheduleSource.id, now);

    return {
      status: "IMPORTED_AND_APPLIED",
      scheduleSourceId: scheduleSource.id,
      refresh,
      dryRun,
      gate,
      apply,
    };
  } finally {
    // Released even when the import throws, so a failure costs one cycle rather
    // than blocking imports until the lease expires.
    await releaseImportLease(db, scheduleSource.id, lease);
  }
}
