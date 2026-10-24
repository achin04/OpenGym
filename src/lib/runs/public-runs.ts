import { SourceRunStatus } from "@/generated/prisma/enums";
import type { AvailabilityRange } from "./availability";

/**
 * The one definition of "a run the public can see".
 *
 * Extracted because two pages now ask the question and they must not drift:
 * the /runs listing, and the home map's "which venues have basketball coming
 * up". If the map used a different rule, a venue could show a pin while its
 * runs were absent from the list it links to -- a discrepancy that reads as a
 * map bug and would be debugged as one.
 *
 * Note what is NOT here: reviewStatus. The listing has never filtered on it,
 * so an imported run still sitting at PENDING is publicly visible today. That
 * may well be wrong, but it is a decision about the import pipeline's review
 * gate, not about the map, and encoding a different answer here would only
 * make the two views disagree. Change it in one place when it changes.
 */
export type PublicRunFilter = {
  sourceStatus: typeof SourceRunStatus.ACTIVE;
  startTime: AvailabilityRange;
};

export function publicRunFilter(startTime: AvailabilityRange): PublicRunFilter {
  return {
    sourceStatus: SourceRunStatus.ACTIVE,
    startTime,
  };
}

/** Every run that has not started yet, with no upper bound. */
export function upcomingRunFilter(now: Date): PublicRunFilter {
  return publicRunFilter({ gte: now });
}
