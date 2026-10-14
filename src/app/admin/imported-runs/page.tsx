import Link from "next/link";
import { formatDateTime, formatLabel } from "@/lib/formatters";
import { getAdminImportBatches } from "@/server/admin/imported-runs/queries";
import { requireAdmin } from "@/server/admin";

export default async function AdminImportedRunsPage() {
  await requireAdmin();

  const batches = await getAdminImportBatches();

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-foreground">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Admin
            </p>

            <h1 className="text-4xl font-semibold tracking-normal">
              Imported Runs
            </h1>

            <p className="max-w-2xl text-zinc-600">
              Review Toronto dry-run batches before applying imported runs.
              New source venues are created automatically when the importer can
              do so safely.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/imported-venues"
              className="w-fit rounded-md border border-foreground/10 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-foreground/10"
            >
              Imported venues
            </Link>
            <Link
              href="/admin/imported-runs/new"
              className="w-fit rounded-md border border-foreground/10 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-foreground/10"
            >
              Manual imported run
            </Link>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 text-zinc-600">
            No import batches yet. Run a Toronto dry import first.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-foreground/5 text-xs uppercase tracking-wide text-zinc-500">
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
              <tbody className="divide-y divide-white/10">
                {batches.map((batch) => (
                  <tr key={batch.id} className="bg-foreground/[0.03] align-top">
                    <td className="px-4 py-4 text-zinc-900">
                      {formatDateTime(batch.startedAt)}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.completedAt
                        ? formatDateTime(batch.completedAt)
                        : "Still running"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-zinc-900">
                        {batch.scheduleSource.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {formatLabel(batch.scheduleSource.sourceType)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.trigger ?? "Unknown"}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatLabel(batch.mode)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {formatLabel(batch.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.isCompleteSnapshot ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      <div>{batch.dropInRecordCount} source</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {batch.basketballRecordCount} basketball
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.createdCount}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.updatedCount}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.unchangedCount}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.skippedCount}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {batch.errorCount}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/imported-runs/${batch.id}`}
                        className="font-semibold text-emerald-600 hover:text-emerald-700"
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
