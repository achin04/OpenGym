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
      <div className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {countItems.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-zinc-100">
              {value}
            </dd>
          </div>
        ))}
      </div>

      <dl className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {summaryItems.map(([label, value]) => (
          <div key={label}>
            <dt className="text-zinc-500">{label}</dt>
            <dd className="mt-1 break-words text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>

      {batch.errorSummary ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
          {batch.errorSummary}
        </div>
      ) : null}
    </section>
  );
}
