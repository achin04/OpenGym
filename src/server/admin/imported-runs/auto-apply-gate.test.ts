import { describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
} from "@/generated/prisma/enums";
import {
  DEFAULT_AUTO_APPLY_LIMITS,
  evaluateAutoApply,
  type AutoApplyBlockerCode,
  type AutoApplyCandidateBatch,
} from "./auto-apply-gate";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-09-17T12:00:00.000Z");

function batch(
  overrides: Partial<AutoApplyCandidateBatch> = {},
): AutoApplyCandidateBatch {
  return {
    id: "batch-1",
    mode: ImportBatchMode.DRY_RUN,
    status: ImportBatchStatus.SUCCEEDED,
    isCompleteSnapshot: true,
    completedAt: new Date("2026-09-17T11:58:00.000Z"),
    updatedCount: 20,
    unchangedCount: 1_500,
    missingCount: 3,
    errorCount: 0,
    appliedBatchId: null,
    ...overrides,
  };
}

function codesFor(overrides: Partial<AutoApplyCandidateBatch>): AutoApplyBlockerCode[] {
  return evaluateAutoApply(batch(overrides), { now: NOW }).blockers.map(
    (blocker) => blocker.code,
  );
}

describe("evaluateAutoApply", () => {
  it("allows a fresh, clean, complete snapshot", () => {
    const evaluation = evaluateAutoApply(batch(), { now: NOW });

    expect(evaluation.canAutoApply).toBe(true);
    expect(evaluation.blockers).toEqual([]);
    expect(evaluation.knownRunCount).toBe(1_523);
  });

  it("blocks a batch that is not a dry run", () => {
    expect(codesFor({ mode: ImportBatchMode.APPLY })).toContain("NOT_DRY_RUN");
  });

  it("blocks a batch that has not finished", () => {
    expect(
      codesFor({
        status: ImportBatchStatus.RUNNING,
        completedAt: null,
      }),
    ).toEqual(expect.arrayContaining(["NOT_COMPLETED", "UNUSABLE_STATUS"]));
  });

  it("blocks a failed batch", () => {
    expect(codesFor({ status: ImportBatchStatus.FAILED })).toContain(
      "UNUSABLE_STATUS",
    );
  });

  it("blocks an incomplete snapshot", () => {
    expect(codesFor({ isCompleteSnapshot: false })).toContain(
      "INCOMPLETE_SNAPSHOT",
    );
  });

  it("blocks a batch holding any error item", () => {
    expect(codesFor({ errorCount: 1 })).toContain("HAS_ERRORS");
  });

  it("allows a partial batch with skipped venue exceptions", () => {
    // Unmatched venues are an expected steady state, so they must not stop
    // auto-apply - otherwise it would never run.
    const evaluation = evaluateAutoApply(
      batch({ status: ImportBatchStatus.PARTIAL }),
      { now: NOW },
    );

    expect(evaluation.canAutoApply).toBe(true);
  });

  it("blocks a batch that was already applied", () => {
    expect(codesFor({ appliedBatchId: "apply-batch-1" })).toContain(
      "ALREADY_APPLIED",
    );
  });

  it("blocks a batch older than the age limit", () => {
    expect(
      codesFor({ completedAt: new Date("2026-09-16T11:00:00.000Z") }),
    ).toContain("BATCH_TOO_OLD");
  });

  it("allows a batch right at the age limit", () => {
    const completedAt = new Date(
      NOW.getTime() - DEFAULT_AUTO_APPLY_LIMITS.maxBatchAgeMs,
    );

    expect(
      evaluateAutoApply(batch({ completedAt }), { now: NOW }).canAutoApply,
    ).toBe(true);
  });

  it("blocks an implausible number of missing runs", () => {
    const evaluation = evaluateAutoApply(
      batch({
        missingCount: DEFAULT_AUTO_APPLY_LIMITS.maxMissingCount + 1,
        unchangedCount: 10_000,
      }),
      { now: NOW },
    );

    expect(evaluation.canAutoApply).toBe(false);
    expect(evaluation.blockers.map((blocker) => blocker.code)).toContain(
      "TOO_MANY_MISSING",
    );
  });

  it("blocks a missing proportion that is too high even when the count is small", () => {
    const evaluation = evaluateAutoApply(
      batch({
        updatedCount: 0,
        unchangedCount: 10,
        missingCount: 10,
      }),
      { now: NOW },
    );

    expect(evaluation.canAutoApply).toBe(false);
    expect(evaluation.blockers[0]?.code).toBe("TOO_MANY_MISSING");
    expect(evaluation.missingRatio).toBe(0.5);
  });

  it("does not divide by zero when the batch knew of no runs", () => {
    const evaluation = evaluateAutoApply(
      batch({ updatedCount: 0, unchangedCount: 0, missingCount: 0 }),
      { now: NOW },
    );

    expect(evaluation.missingRatio).toBe(0);
    expect(evaluation.canAutoApply).toBe(true);
  });

  it("honours overridden limits", () => {
    const evaluation = evaluateAutoApply(batch({ missingCount: 5 }), {
      now: NOW,
      limits: { maxMissingCount: 4 },
    });

    expect(evaluation.canAutoApply).toBe(false);
    expect(evaluation.blockers[0]?.code).toBe("TOO_MANY_MISSING");
  });

  it("reports every blocker rather than only the first", () => {
    const codes = codesFor({
      isCompleteSnapshot: false,
      errorCount: 2,
      appliedBatchId: "apply-batch-1",
    });

    expect(codes).toEqual(
      expect.arrayContaining([
        "INCOMPLETE_SNAPSHOT",
        "HAS_ERRORS",
        "ALREADY_APPLIED",
      ]),
    );
  });
});
