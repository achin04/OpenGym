import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportBatchSummary } from "@/app/admin/imported-runs/_components/import-batch-summary";
import { ImportItemTable } from "@/app/admin/imported-runs/_components/import-item-table";
import { PendingVenueSection } from "@/app/admin/imported-runs/_components/pending-venue-section";
import {
  getAdminImportBatchDetail,
  getAdminVenueOptions,
} from "@/server/admin/imported-runs/queries";
import { requireAdmin } from "@/server/admin";

type AdminImportBatchDetailPageProps = {
  params: Promise<{
    batchId: string;
  }>;
};

export default async function AdminImportBatchDetailPage({
  params,
}: AdminImportBatchDetailPageProps) {
  await requireAdmin();

  const { batchId } = await params;
  const [detail, venues] = await Promise.all([
    getAdminImportBatchDetail(batchId),
    getAdminVenueOptions(),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-7xl space-y-10">
        <div className="space-y-4">
          <Link
            href="/admin/imported-runs"
            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Back to import batches
          </Link>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Admin import preview
            </p>
            <h1 className="text-4xl font-semibold tracking-normal">
              Import batch detail
            </h1>
            <p className="max-w-3xl text-zinc-300">
              Review this dry-run batch, resolve pending Toronto venue
              references, then rerun the dry import before applying imported
              runs.
            </p>
          </div>
        </div>

        <ImportBatchSummary detail={detail} />

        <PendingVenueSection
          batchId={detail.batch.id}
          groups={detail.pendingVenueGroups}
          venues={venues}
        />

        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          After resolving venues, rerun{" "}
          <code className="rounded bg-zinc-950/70 px-1.5 py-0.5 text-emerald-200">
            npm run import:toronto:dry-run
          </code>{" "}
          so candidates for matched locations can be classified as create,
          update, or unchanged.
        </div>

        <div className="space-y-10">
          <ImportItemTable
            title="Create"
            description="Candidates that would create new runs after venue resolution."
            items={detail.itemGroups.create}
          />

          <ImportItemTable
            title="Update"
            description="Candidates that match existing imported runs and have proposed field changes."
            items={detail.itemGroups.update}
          />

          <ImportItemTable
            title="Unchanged"
            description="Candidates that match existing imported runs with no proposed changes."
            items={detail.itemGroups.unchanged}
          />

          <ImportItemTable
            title="Skipped"
            description="Candidates that were not ready for import. Venue-related skipped items should be resolved above."
            items={detail.itemGroups.skipped}
          />

          <ImportItemTable
            title="Errors"
            description="Candidates or source rows that could not be processed safely."
            items={detail.itemGroups.error}
          />
        </div>
      </section>
    </main>
  );
}
