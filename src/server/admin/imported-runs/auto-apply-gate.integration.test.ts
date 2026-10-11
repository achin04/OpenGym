import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImportBatchMode,
  ImportBatchStatus,
  RunSourceType,
} from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { applyImportBatch } from "./apply-import-batch";
import { evaluateAutoApplyForBatch } from "./auto-apply-gate";

vi.mock("server-only", () => ({}));

async function cleanDatabase() {
  await prisma.importItem.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.scheduleSource.deleteMany();
}

async function createScheduleSource() {
  return prisma.scheduleSource.create({
    data: {
      name: "City of Toronto Drop-In Gate Test",
      sourceType: RunSourceType.CITY,
      url: "https://open.toronto.ca/dataset/auto-apply-gate-test/",
      providerKey: "toronto-drop-in-gate-test",
      externalDatasetId: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    },
  });
}

async function createDryRunBatch(scheduleSourceId: string) {
  return prisma.importBatch.create({
    data: {
      scheduleSourceId,
      trigger: "test",
      mode: ImportBatchMode.DRY_RUN,
      status: ImportBatchStatus.SUCCEEDED,
      isCompleteSnapshot: true,
      completedAt: new Date(),
      unchangedCount: 100,
      missingCount: 2,
    },
  });
}

describe("evaluateAutoApplyForBatch", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("returns null for a batch that does not exist", async () => {
    await expect(
      evaluateAutoApplyForBatch(prisma, "no-such-batch"),
    ).resolves.toBeNull();
  });

  it("clears a freshly completed dry run", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createDryRunBatch(scheduleSource.id);

    const evaluation = await evaluateAutoApplyForBatch(prisma, batch.id);

    expect(evaluation?.canAutoApply).toBe(true);
    expect(evaluation?.knownRunCount).toBe(102);
  });

  it("blocks a batch once it has actually been applied", async () => {
    const scheduleSource = await createScheduleSource();
    const batch = await createDryRunBatch(scheduleSource.id);

    // Exercised through the real apply path rather than by writing an APPLY row
    // directly, so this fails if the two sides ever disagree on the trigger
    // that links a dry run to its apply batch.
    const applied = await applyImportBatch(batch.id);
    const evaluation = await evaluateAutoApplyForBatch(prisma, batch.id);

    expect(evaluation?.canAutoApply).toBe(false);
    expect(evaluation?.blockers.map((blocker) => blocker.code)).toEqual([
      "ALREADY_APPLIED",
    ]);
    expect(evaluation?.blockers[0]?.message).toContain(applied.applyBatchId);
  });
});
