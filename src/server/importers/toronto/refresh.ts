import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ImportBatchMode, ImportBatchStatus } from "@/generated/prisma/enums";
import {
  TORONTO_RESOURCE_NAMES,
  findActiveResourceByName,
  resourceModifiedAt,
  type CkanPackage,
  type TorontoCkanClient,
} from "./ckan";

type TorontoRefreshPrisma = Pick<PrismaClient, "importBatch">;

// Vercel's Hobby plan caps cron at one run per day, but Toronto refreshes
// weekly. Running the full dry run on every tick would write a batch and
// roughly 1,600 import items to the database six days out of seven, burying the
// one batch per week that actually matters. This module is the cheap pre-check
// that lets a caller skip that work: a single package_show request compared
// against the last snapshot we successfully read.

const RESOURCE_KEYS = ["dropIn", "locations", "facilities"] as const;

type ResourceKey = (typeof RESOURCE_KEYS)[number];

export type ObservedResourceState = {
  resourceId: string | null;
  modifiedAt: Date | null;
};

export type ObservedTorontoSourceState = {
  // Recorded for diagnostics only - nothing compares it, because the three
  // resource states below are the signal for "did the data we read change".
  packageMetadataModifiedAt: Date | null;
} & Record<ResourceKey, ObservedResourceState>;

export type PreviousTorontoSourceState = {
  batchId: string;
} & Record<ResourceKey, ObservedResourceState>;

export type TorontoRefreshReason =
  | "NO_PREVIOUS_SNAPSHOT"
  | "RESOURCE_REPLACED"
  | "RESOURCE_MODIFIED"
  | "TIMESTAMPS_UNAVAILABLE"
  | "UNCHANGED";

export type TorontoRefreshDetection = {
  hasRefreshed: boolean;
  reason: TorontoRefreshReason;
  details: string;
  observed: ObservedTorontoSourceState;
  comparedBatchId: string | null;
};

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function observeResource(
  pkg: CkanPackage,
  expectedName: string,
): ObservedResourceState {
  const resource = findActiveResourceByName(pkg, expectedName);

  if (!resource) {
    return {
      resourceId: null,
      modifiedAt: null,
    };
  }

  return {
    resourceId: resource.id,
    modifiedAt: resourceModifiedAt(resource),
  };
}

// Deliberately uses the light name lookup rather than findDropInResource and
// friends, which each spend a datastore_search verifying field names. Keeping
// detection to one request matters, but so does where failures land: if Toronto
// renames a column, the dry run should be the thing that fails, because it can
// record the failure on an ImportBatch. Detection has nowhere to put it.
export function observeTorontoSourceState(
  pkg: CkanPackage,
): ObservedTorontoSourceState {
  return {
    packageMetadataModifiedAt: parseTimestamp(pkg.metadata_modified),
    dropIn: observeResource(pkg, TORONTO_RESOURCE_NAMES.dropIn),
    locations: observeResource(pkg, TORONTO_RESOURCE_NAMES.locations),
    facilities: observeResource(pkg, TORONTO_RESOURCE_NAMES.facilities),
  };
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) {
    // Equal only when both are absent. One side having a timestamp the other
    // lacks is a real change, including the case where we lose a signal we
    // previously had.
    return left === right;
  }

  return left.getTime() === right.getTime();
}

function describeKeys(keys: readonly ResourceKey[]): string {
  return keys.map((key) => TORONTO_RESOURCE_NAMES[key]).join(", ");
}

export function compareTorontoSourceState(
  observed: ObservedTorontoSourceState,
  previous: PreviousTorontoSourceState | null,
): TorontoRefreshDetection {
  if (!previous) {
    return {
      hasRefreshed: true,
      reason: "NO_PREVIOUS_SNAPSHOT",
      details:
        "No completed, complete-snapshot dry run exists for this schedule source yet.",
      observed,
      comparedBatchId: null,
    };
  }

  // A new resource id means Toronto republished the resource outright, which is
  // a refresh even when the timestamps look untouched.
  const replaced = RESOURCE_KEYS.filter(
    (key) => observed[key].resourceId !== previous[key].resourceId,
  );

  if (replaced.length > 0) {
    return {
      hasRefreshed: true,
      reason: "RESOURCE_REPLACED",
      details: `Resource ids changed since batch ${previous.batchId}: ${describeKeys(replaced)}.`,
      observed,
      comparedBatchId: previous.batchId,
    };
  }

  // Compared for difference rather than for being newer: if Toronto rolls a
  // resource back, that is still a change we need to ingest.
  const modified = RESOURCE_KEYS.filter(
    (key) => !sameInstant(observed[key].modifiedAt, previous[key].modifiedAt),
  );

  if (modified.length > 0) {
    return {
      hasRefreshed: true,
      reason: "RESOURCE_MODIFIED",
      details: `Resource timestamps changed since batch ${previous.batchId}: ${describeKeys(modified)}.`,
      observed,
      comparedBatchId: previous.batchId,
    };
  }

  // Every resource id matches and no timestamp moved - but if CKAN reports no
  // timestamps at all, that proves nothing. This fails open on purpose:
  // importing redundantly is a visible annoyance, whereas failing closed would
  // silently stop importing forever. CKAN already returns a null
  // `last_modified` on every active resource in this dataset, so this path is
  // one upstream change away, not hypothetical.
  const comparable = RESOURCE_KEYS.filter(
    (key) => observed[key].modifiedAt !== null,
  );

  if (comparable.length === 0) {
    return {
      hasRefreshed: true,
      reason: "TIMESTAMPS_UNAVAILABLE",
      details: `No resource reported a modification timestamp, so a refresh cannot be ruled out against batch ${previous.batchId}.`,
      observed,
      comparedBatchId: previous.batchId,
    };
  }

  return {
    hasRefreshed: false,
    reason: "UNCHANGED",
    details: `Resource ids and timestamps match batch ${previous.batchId}.`,
    observed,
    comparedBatchId: previous.batchId,
  };
}

// The comparison baseline is the newest batch we can trust as a full read of
// the source. The exclusions carry the weight: an incomplete snapshot or a
// still-running batch recorded timestamps for a read we could not rely on, and
// letting one of those suppress the next import would strand the app on bad
// data until Toronto happened to refresh again. These are the same conditions
// assertDryRunBatchCanApply requires before a batch may be applied.
async function findLastIngestedSnapshot(
  db: TorontoRefreshPrisma,
  scheduleSourceId: string,
): Promise<PreviousTorontoSourceState | null> {
  const batch = await db.importBatch.findFirst({
    where: {
      scheduleSourceId,
      mode: ImportBatchMode.DRY_RUN,
      isCompleteSnapshot: true,
      completedAt: {
        not: null,
      },
      status: {
        in: [ImportBatchStatus.SUCCEEDED, ImportBatchStatus.PARTIAL],
      },
    },
    select: {
      id: true,
      dropInResourceId: true,
      locationsResourceId: true,
      facilitiesResourceId: true,
      dropInResourceLastModifiedAt: true,
      locationsResourceLastModifiedAt: true,
      facilitiesResourceLastModifiedAt: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!batch) {
    return null;
  }

  return {
    batchId: batch.id,
    dropIn: {
      resourceId: batch.dropInResourceId,
      modifiedAt: batch.dropInResourceLastModifiedAt,
    },
    locations: {
      resourceId: batch.locationsResourceId,
      modifiedAt: batch.locationsResourceLastModifiedAt,
    },
    facilities: {
      resourceId: batch.facilitiesResourceId,
      modifiedAt: batch.facilitiesResourceLastModifiedAt,
    },
  };
}

export async function detectTorontoRefresh({
  db,
  scheduleSourceId,
  client,
}: {
  db: TorontoRefreshPrisma;
  scheduleSourceId: string;
  client: Pick<TorontoCkanClient, "getPackage">;
}): Promise<TorontoRefreshDetection> {
  const [pkg, previous] = await Promise.all([
    client.getPackage(),
    findLastIngestedSnapshot(db, scheduleSourceId),
  ]);

  return compareTorontoSourceState(observeTorontoSourceState(pkg), previous);
}
