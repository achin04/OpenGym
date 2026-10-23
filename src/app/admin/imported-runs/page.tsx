import Link from "next/link";
import { formatDateTime, formatLabel } from "@/lib/formatters";
import { getAdminImportBatches } from "@/server/admin/imported-runs/queries";
import { requireAdmin } from "@/server/admin";
import { raisedButtonClass } from "@/app/_components/raised-button";

export default async function AdminImportedRunsPage() {
  await requireAdmin();

  const batches = await getAdminImportBatches();

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
              Admin
            </p>

            <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
              Imported Runs
            </h1>

            <p className="max-w-2xl text-foreground/70">
              Review Toronto dry-run batches before applying imported runs.
              New source venues are created automatically when the importer can
              do so safely.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/imported-venues"
              className={`w-fit ${raisedButtonClass()}`}
            >
              Imported venues
            </Link>
            <Link
              href="/admin/imported-runs/new"
              className={`w-fit ${raisedButtonClass()}`}
            >
              Manual imported run
            </Link>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] text-foreground/70">
            No import batches yet. Run a Toronto dry import first.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[16px] border-2 border-foreground bg-surface">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-foreground/[0.07] text-xs uppercase tracking-[0.14em] text-foreground/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 font-semibold">Completed</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Trigger</th>
                  <th className="px-4 py-3 font-semibold">Mode</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Complete</th>
                  <th className="px-4 py-3 font-semibold">Records</th>
                  <th className="px-4 py-3 font-semibold">Create</th>
                  <th className="px-4 py-3 font-semibold">Update</th>
                  <th className="px-4 py-3 font-semibold">Unchanged</th>
                  <th className="px-4 py-3 font-semibold">Skipped</th>
                  <th className="px-4 py-3 font-semibold">Errors</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-line">
                {batches.map((batch) => (
                  <tr key={batch.id} className="bg-foreground/[0.03] align-top">
                    <td className="px-4 py-4 text-foreground">
                      {formatDateTime(batch.startedAt)}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.completedAt
                        ? formatDateTime(batch.completedAt)
                        : "Still running"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-foreground">
                        {batch.scheduleSource.name}
                      </div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {formatLabel(batch.scheduleSource.sourceType)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.trigger ?? "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {formatLabel(batch.mode)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border-2 border-foreground bg-white px-3 py-1 text-xs font-semibold text-foreground">
                        {formatLabel(batch.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.isCompleteSnapshot ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      <div>{batch.dropInRecordCount} source</div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {batch.basketballRecordCount} basketball
                      </div>
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.createdCount}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.updatedCount}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.unchangedCount}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.skippedCount}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      {batch.errorCount}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/imported-runs/${batch.id}`}
                        className="font-semibold text-foreground underline underline-offset-2 hover:text-link-hover"
                      >
                        View batch
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
