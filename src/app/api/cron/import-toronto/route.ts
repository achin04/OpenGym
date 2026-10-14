import { timingSafeEqual } from "node:crypto";
import {
  runTorontoAutoImport,
  type TorontoAutoImportResult,
} from "@/server/importers/toronto/auto-import";

// Vercel Hobby allows up to 300s per function invocation, and that is also the
// default. Stated explicitly because this route is the one place in the app
// where the limit matters: a full snapshot fetch plus roughly 1,600 item writes
// is far slower than any page render.
export const maxDuration = 300;

// Nothing about this response is cacheable, and a cached cron endpoint would
// silently stop importing.
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[toronto-cron]";

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
    const durationMs = Date.now() - startedAt;

    console.log(
      `${LOG_PREFIX} ${result.status} in ${durationMs}ms ${JSON.stringify(summary)}`,
    );

    return Response.json({ ...summary, durationMs }, { status: 200 });
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
