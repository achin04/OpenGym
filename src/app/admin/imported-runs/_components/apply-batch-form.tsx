"use client";

import Link from "next/link";
import { useActionState } from "react";
import { formatLabel } from "@/lib/formatters";
import { initialAdminActionState } from "@/lib/admin/imported-runs/action-validation";
import { applyImportBatchAction } from "@/app/admin/imported-runs/actions";
import { raisedButtonClass } from "@/app/_components/raised-button";

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
      className={`w-fit ${raisedButtonClass({ variant: "success" })} disabled:cursor-not-allowed disabled:opacity-50`}
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
      <section className="rounded-[20px] border-2 border-foreground bg-success/15 p-6 shadow-[0_6px_0_0_var(--foreground)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Batch already applied
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-foreground/75">
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
            className={`w-fit ${raisedButtonClass()}`}
          >
            View apply audit
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Apply dry-run batch</h2>
          <p className="mt-2 max-w-3xl text-sm text-foreground/60">
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
              ? "mt-4 text-sm font-semibold text-success"
              : "mt-4 text-sm font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      {!canApply ? (
        <p className="mt-4 text-sm text-foreground/60">
          This batch cannot be applied from its current state.
        </p>
      ) : null}
    </section>
  );
}
