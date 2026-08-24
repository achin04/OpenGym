"use client";

import Link from "next/link";
import { useActionState } from "react";
import { formatLabel } from "@/lib/formatters";
import { initialAdminActionState } from "@/lib/admin/imported-runs/action-validation";
import { applyImportBatchAction } from "@/app/admin/imported-runs/actions";

type ApplyBatchFormProps = {
  batchId: string;
  canApply: boolean;
  eligibleCreateCount: number;
  eligibleUpdateCount: number;
  appliedBatch: {
    id: string;
    status: string;
    createdCount: number;
    updatedCount: number;
    unchangedCount: number;
    skippedCount: number;
    errorCount: number;
  } | null;
};

function SubmitButton({ canApply }: { canApply: boolean }) {
  return (
    <button
      type="submit"
      disabled={!canApply}
      className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
    >
      Apply batch
    </button>
  );
}

export function ApplyBatchForm({
  batchId,
  canApply,
  eligibleCreateCount,
  eligibleUpdateCount,
  appliedBatch,
}: ApplyBatchFormProps) {
  const [state, formAction, isPending] = useActionState(
    applyImportBatchAction,
    initialAdminActionState,
  );
  const applyCount = eligibleCreateCount + eligibleUpdateCount;

  if (appliedBatch) {
    return (
      <section className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-emerald-100">
              Batch already applied
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-emerald-50/80">
              Apply batch {appliedBatch.id} finished with{" "}
              {formatLabel(appliedBatch.status)}:{" "}
              {appliedBatch.createdCount} created, {appliedBatch.updatedCount}{" "}
              updated, {appliedBatch.unchangedCount} unchanged,{" "}
              {appliedBatch.skippedCount} skipped, {appliedBatch.errorCount}{" "}
              errors.
            </p>
          </div>

          <Link
            href={`/admin/imported-runs/${appliedBatch.id}`}
            className="w-fit rounded-md border border-emerald-200/40 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-200/10"
          >
            View apply audit
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Apply dry-run batch</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            {applyCount} eligible items: {eligibleCreateCount} create,{" "}
            {eligibleUpdateCount} update.
          </p>
        </div>

        <form action={formAction}>
          <input type="hidden" name="batchId" value={batchId} />
          <SubmitButton canApply={canApply && !isPending} />
        </form>
      </div>

      {state.status !== "idle" ? (
        <p
          className={
            state.status === "success"
              ? "mt-4 text-sm text-emerald-200"
              : "mt-4 text-sm text-rose-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      {!canApply ? (
        <p className="mt-4 text-sm text-zinc-500">
          This batch cannot be applied from its current state.
        </p>
      ) : null}
    </section>
  );
}
