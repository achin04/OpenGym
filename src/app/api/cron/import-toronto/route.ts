import { timingSafeEqual } from "node:crypto";
import {
  runTorontoAutoImport,
  type TorontoAutoImportResult,
} from "@/server/importers/toronto/auto-import";
import {
  geocodeMissingVenues,
  type GeocodeMissingResult,
} from "@/server/geocoding/venue-coordinates";

// Vercel Hobby allows up to 300s per function invocation, and that is also the
// default. Stated explicitly because this route is the one place in the app
// where the limit matters: a full snapshot fetch plus roughly 1,600 item writes
// is far slower than any page render.
export const maxDuration = 300;

// Nothing about this response is cacheable, and a cached cron endpoint would
// silently stop importing.
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[toronto-cron]";

/**
 * Wall-clock left for geocoding, and the slice of it kept back.
 *
 * The import runs first and takes an unpredictable length of time, so the
 * backfill gets whatever remains of maxDuration rather than a fixed count.
 * RESERVE is held back for the response, the logging and the usual overhead --
 * a function killed mid-write is worse than one that geocodes a few venues
 * fewer.
 */
const MAX_DURATION_MS = maxDuration * 1_000;
const RESERVE_MS = 20_000;

/**
 * Coordinates for venues that still have none.
 *
 * Here rather than only behind the admin button because the backlog should
 * drain on its own. A venue with no coordinates is invisible on the map, and
 * leaving that to someone remembering to press a button nightly is how it
 * stays broken.
 *
 * Deliberately swallows its own failures. Geocoding is enrichment on top of
 * the import, and Nominatim being down or slow must not turn a successful
 * import into a failed cron run.
 */
async function backfillCoordinates(
  elapsedMs: number,
): Promise<GeocodeMissingResult | { error: string }> {
  const timeBudgetMs = MAX_DURATION_MS - elapsedMs - RESERVE_MS;

  if (timeBudgetMs <= 0) {
    return { error: "No time left after the import." };
  }

  try {
    return await geocodeMissingVenues({
      // The budget is the real limit; this only stops the query loading every
      // row in the table when the backlog is large.
      limit: 500,
      timeBudgetMs,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set on the project, so the same check covers the scheduler and a manual
// curl. Compared in constant time: a plain === leaks how much of the secret a
// guess got right, and this endpoint mutates published data.
function isAuthorized(request: Request, secret: string): boolean {
  const provided = request.headers.get("authorization");

  if (!provided) {
    return false;
  }

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(`Bearer ${secret}`);

  // timingSafeEqual throws on a length mismatch, and length is not secret.
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

// Trimmed on purpose. The full result carries every duplicate occurrence and
// every affected run id, which would run to thousands of entries in a log line
// that is meant to be readable.
function summarize(result: TorontoAutoImportResult) {
  return {
    status: result.status,
    recoveredPendingBatch: result.recoveredPendingBatch ?? false,
    refresh: result.refresh
      ? {
          hasRefreshed: result.refresh.hasRefreshed,
          reason: result.refresh.reason,
          details: result.refresh.details,
          comparedBatchId: result.refresh.comparedBatchId,
        }
      : null,
    dryRun: result.dryRun
      ? {
          batchId: result.dryRun.batchId,
          status: result.dryRun.status,
          isCompleteSnapshot: result.dryRun.isCompleteSnapshot,
          counts: result.dryRun.counts,
        }
      : null,
    gate: result.gate
      ? {
          canAutoApply: result.gate.canAutoApply,
          blockers: result.gate.blockers,
          missingCount: result.gate.missingCount,
          knownRunCount: result.gate.knownRunCount,
        }
      : null,
    apply: result.apply
      ? {
          applyBatchId: result.apply.applyBatchId,
          alreadyApplied: result.apply.alreadyApplied,
          affectedRunCount: result.apply.affectedRunIds.length,
          counts: result.apply.counts,
        }
      : null,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run unauthenticated. An unset secret in production would
  // otherwise leave a route that mutates published runs open to anyone.
  if (!secret) {
    console.error(`${LOG_PREFIX} CRON_SECRET is not set; refusing to run.`);

    return Response.json(
      { error: "Cron is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const result = await runTorontoAutoImport();
    const summary = summarize(result);

    // After the import, not before: the import is what the schedule exists for
    // and must get the time it needs, and it can create venues that then want
    // geocoding in the same run.
    const geocode = await backfillCoordinates(Date.now() - startedAt);
    const durationMs = Date.now() - startedAt;

    console.log(
      `${LOG_PREFIX} ${result.status} in ${durationMs}ms ${JSON.stringify({ ...summary, geocode })}`,
    );

    return Response.json({ ...summary, geocode, durationMs }, { status: 200 });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    console.error(`${LOG_PREFIX} failed after ${durationMs}ms: ${message}`);

    // The caller is authenticated by this point, so the real message is more
    // useful than a generic one. A dry run that got far enough to create a
    // batch has already recorded the failure on it.
    return Response.json({ error: message, durationMs }, { status: 500 });
  }
}
