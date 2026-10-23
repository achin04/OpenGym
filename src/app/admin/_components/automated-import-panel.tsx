import Link from "next/link";
import { ImportBatchStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/formatters";
import type { AdminAutomatedImportStatus } from "@/server/admin/imported-runs/queries";

type AutomatedImportPanelProps = {
  status: AdminAutomatedImportStatus | null;
};

// When the automated gate declines a batch, the batch simply waits - which is
// the designed fallback, but silent. This panel is how that gets noticed.
function reviewNotice(status: AdminAutomatedImportStatus) {
  const { latestDryRun } = status;

  if (latestDryRun.status === ImportBatchStatus.RUNNING) {
    return null;
  }

  if (latestDryRun.isApplied) {
    return null;
  }

  const proposed =
    latestDryRun.createdCount +
    latestDryRun.updatedCount +
    latestDryRun.missingCount;

  if (proposed === 0 && latestDryRun.errorCount === 0) {
    return null;
  }

  return latestDryRun.errorCount > 0
    ? `This batch has ${latestDryRun.errorCount} error item(s), so it was not applied automatically.`
    : `This batch proposes ${proposed} change(s) that have not been applied.`;
}

export function AutomatedImportPanel({ status }: AutomatedImportPanelProps) {
  if (!status) {
    return (
      <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]">
        <h2 className="text-xl font-semibold">Automated import</h2>
        <p className="mt-2 text-sm text-foreground/70">
          No import has run yet. The daily cron builds a batch only when the
          source publishes new data.
        </p>
      </div>
    );
  }

  const { scheduleSource, latestDryRun, importInFlight } = status;
  const notice = reviewNotice(status);

  return (
    <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Automated import</h2>
        {importInFlight ? (
          <span className="rounded-full border-2 border-foreground bg-success px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
            Running now
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-foreground/60">Source</dt>
          <dd className="font-medium">{scheduleSource.name}</dd>
        </div>
        <div>
          <dt className="text-foreground/60">Last published to the site</dt>
          <dd className="font-medium">
            {scheduleSource.lastSuccessfulImportAt
              ? formatDateTime(scheduleSource.lastSuccessfulImportAt)
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="text-foreground/60">Last batch</dt>
          <dd className="font-medium">
            {formatDateTime(latestDryRun.startedAt)} · {latestDryRun.status}
          </dd>
        </div>
      </dl>

      {notice ? (
        <p className="mt-4 rounded-[16px] border-2 border-foreground bg-court/15 p-4 text-sm text-foreground">
          {notice}{" "}
          <Link
            href={`/admin/imported-runs/${latestDryRun.id}`}
            className="font-semibold underline underline-offset-2 hover:text-link-hover"
          >
            Review it
          </Link>
          .
        </p>
      ) : null}

      <p className="mt-4 text-sm text-foreground/70">
        Created {latestDryRun.createdCount}, updated {latestDryRun.updatedCount},
        missing {latestDryRun.missingCount}, skipped{" "}
        {latestDryRun.skippedCount}, errors {latestDryRun.errorCount}.{" "}
        <Link
          href="/admin/imported-runs"
          className="font-semibold text-foreground underline underline-offset-2 hover:text-link-hover"
        >
          All batches
        </Link>
      </p>
    </div>
  );
}
