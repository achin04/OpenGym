import { SourceRunStatus } from "@/generated/prisma/enums";

export type RunSourceNotice = {
  heading: string;
  body: string;
};

// Copy for the banner shown on a run whose upstream source no longer lists it.
//
// Imported runs are delisted rather than deleted (see applyMissingItem in
// src/server/admin/imported-runs/apply-import-batch.ts), so their detail pages
// stay reachable and have to say why the run is no longer in search results.
//
// sourceLabel is the already-formatted provider name, so this stays correct
// when a second municipality is added. STALE deliberately returns null: nothing
// in the codebase writes that status yet, and inventing copy for it would mean
// guessing at semantics that have not been decided.
export function sourceStatusNotice(
  sourceStatus: SourceRunStatus,
  sourceLabel: string,
): RunSourceNotice | null {
  if (sourceStatus === SourceRunStatus.REMOVED) {
    return {
      heading: `No longer listed by ${sourceLabel}`,
      body: "This run was dropped from the published schedule, so it has most likely been cancelled. The details below are kept for reference, and the run no longer appears in search results.",
    };
  }

  if (sourceStatus === SourceRunStatus.CANCELLED) {
    return {
      heading: "This run has been cancelled",
      body: "The details below are kept for reference, and the run no longer appears in search results.",
    };
  }

  return null;
}
