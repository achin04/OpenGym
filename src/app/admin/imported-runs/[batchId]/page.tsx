import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ImportBatchMode,
  ImportBatchStatus,
} from "@/generated/prisma/enums";
import { ApplyBatchForm } from "@/app/admin/imported-runs/_components/apply-batch-form";
import { ImportBatchSummary } from "@/app/admin/imported-runs/_components/import-batch-summary";
import { ImportItemTable } from "@/app/admin/imported-runs/_components/import-item-table";
import { PendingVenueSection } from "@/app/admin/imported-runs/_components/pending-venue-section";
import { getAdminImportBatchDetail } from "@/server/admin/imported-runs/queries";
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
  const detail = await getAdminImportBatchDetail(batchId);

  if (!detail) {
    notFound();
  }

  const canApply =
    detail.batch.mode === ImportBatchMode.DRY_RUN &&
    detail.batch.isCompleteSnapshot &&
    !!detail.batch.completedAt &&
    !detail.appliedBatch &&
    (detail.batch.status === ImportBatchStatus.SUCCEEDED ||
      detail.batch.status === ImportBatchStatus.PARTIAL);

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
              Review this dry-run batch before applying imported runs. Source
              venues are matched or created automatically when safe; unresolved
              venue exceptions remain skipped for manual follow-up.
            </p>
          </div>
        </div>

        <ImportBatchSummary detail={detail} />

        <ApplyBatchForm
          batchId={detail.batch.id}
          canApply={canApply}
          eligibleCreateCount={detail.itemGroups.create.length}
          eligibleUpdateCount={detail.itemGroups.update.length}
          appliedBatch={detail.appliedBatch}
        />

        <PendingVenueSection groups={detail.pendingVenueGroups} />

        <div className="space-y-10">
          <ImportItemTable
            title="Create"
            description="Candidates that would create new runs."
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
            description="Candidates that were not ready for import. Venue-related skips now indicate manual review exceptions."
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
