import { formatDateTime, formatLabel } from "@/lib/formatters";
import type { AdminImportBatchDetail } from "@/server/admin/imported-runs/queries";

type ImportBatchSummaryProps = {
  detail: NonNullable<AdminImportBatchDetail>;
};

function truncateHash(value: string | null) {
  return value ? `${value.slice(0, 12)}...` : "None";
}

export function ImportBatchSummary({ detail }: ImportBatchSummaryProps) {
  const { batch } = detail;

  const summaryItems = [
    ["Batch ID", batch.id],
    ["Source", batch.scheduleSource.name],
    ["Source type", formatLabel(batch.scheduleSource.sourceType)],
    ["Started at", formatDateTime(batch.startedAt)],
    [
      "Completed at",
      batch.completedAt ? formatDateTime(batch.completedAt) : "Still running",
    ],
    ["Status", formatLabel(batch.status)],
    ["Mode", formatLabel(batch.mode)],
    ["Trigger", batch.trigger ?? "Unknown"],
    ["Complete snapshot", batch.isCompleteSnapshot ? "Yes" : "No"],
    ["Snapshot hash", truncateHash(batch.snapshotHash)],
    ["Drop-in resource ID", batch.dropInResourceId ?? "Unknown"],
    ["Locations resource ID", batch.locationsResourceId ?? "Unknown"],
    ["Facilities resource ID", batch.facilitiesResourceId ?? "Unknown"],
    [
      "Drop-in modified",
      batch.dropInResourceLastModifiedAt
        ? formatDateTime(batch.dropInResourceLastModifiedAt)
        : "Unknown",
    ],
    [
      "Locations modified",
      batch.locationsResourceLastModifiedAt
        ? formatDateTime(batch.locationsResourceLastModifiedAt)
        : "Unknown",
    ],
    [
      "Facilities modified",
      batch.facilitiesResourceLastModifiedAt
        ? formatDateTime(batch.facilitiesResourceLastModifiedAt)
        : "Unknown",
    ],
  ];

  const countItems = [
    ["Source records", batch.dropInRecordCount],
    ["Locations", batch.locationsRecordCount],
    ["Facilities", batch.facilitiesRecordCount],
    ["Basketball", batch.basketballRecordCount],
    ["Create", batch.createdCount],
    ["Update", batch.updatedCount],
    ["Unchanged", batch.unchangedCount],
    ["Missing", batch.missingCount],
    ["Skipped", batch.skippedCount],
    ["Errors", batch.errorCount],
    ["Unmatched venues", detail.pendingVenueGroups.length],
  ];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] sm:grid-cols-2 lg:grid-cols-4">
        {countItems.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-[0.14em] text-foreground/60">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-bold text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </div>

      <dl className="grid gap-4 rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] text-sm sm:grid-cols-2 lg:grid-cols-3">
        {summaryItems.map(([label, value]) => (
          <div key={label}>
            <dt className="text-foreground/60">{label}</dt>
            <dd className="mt-1 break-words text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {batch.errorSummary ? (
        <div className="rounded-[16px] border-2 border-foreground bg-danger/15 p-4 text-sm text-foreground">
          {batch.errorSummary}
        </div>
      ) : null}
    </section>
  );
}
