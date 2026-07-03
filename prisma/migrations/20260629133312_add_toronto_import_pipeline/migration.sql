/*
  Warnings:

  - A unique constraint covering the columns `[scheduleSourceId,sourceExternalId]` on the table `runs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerKey]` on the table `schedule_sources` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ImportBatchMode" AS ENUM ('DRY_RUN', 'APPLY');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportItemAction" AS ENUM ('CREATE', 'UPDATE', 'UNCHANGED', 'MISSING', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "ImportReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM ('ACTIVE', 'STALE', 'REMOVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VenueMatchStatus" AS ENUM ('MATCHED', 'PENDING', 'IGNORED');

-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "reviewStatus" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "sourceAgeLabel" TEXT,
ADD COLUMN     "sourceExternalId" TEXT,
ADD COLUMN     "sourceFingerprint" TEXT,
ADD COLUMN     "sourceFirstSeenAt" TIMESTAMP(3),
ADD COLUMN     "sourceLastSeenAt" TIMESTAMP(3),
ADD COLUMN     "sourceMaxAge" INTEGER,
ADD COLUMN     "sourceMinAge" INTEGER,
ADD COLUMN     "sourceMissCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceMissingSince" TIMESTAMP(3),
ADD COLUMN     "sourceSeriesId" TEXT,
ADD COLUMN     "sourceStatus" "SourceRunStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "schedule_sources" ADD COLUMN     "attributionText" TEXT,
ADD COLUMN     "config" JSONB,
ADD COLUMN     "externalDatasetId" TEXT,
ADD COLUMN     "lastSuccessfulImportAt" TIMESTAMP(3),
ADD COLUMN     "licenseUrl" TEXT,
ADD COLUMN     "providerKey" TEXT;

-- CreateTable
CREATE TABLE "external_venue_refs" (
    "id" TEXT NOT NULL,
    "scheduleSourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "venueId" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceAddressLine1" TEXT,
    "sourcePostalCode" TEXT,
    "sourceUrl" TEXT,
    "matchStatus" "VenueMatchStatus" NOT NULL DEFAULT 'PENDING',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_venue_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "scheduleSourceId" TEXT NOT NULL,
    "trigger" TEXT,
    "mode" "ImportBatchMode" NOT NULL DEFAULT 'DRY_RUN',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'RUNNING',
    "isCompleteSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "dropInResourceId" TEXT,
    "locationsResourceId" TEXT,
    "facilitiesResourceId" TEXT,
    "dropInResourceLastModifiedAt" TIMESTAMP(3),
    "locationsResourceLastModifiedAt" TIMESTAMP(3),
    "facilitiesResourceLastModifiedAt" TIMESTAMP(3),
    "snapshotHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dropInRecordCount" INTEGER NOT NULL DEFAULT 0,
    "locationsRecordCount" INTEGER NOT NULL DEFAULT 0,
    "facilitiesRecordCount" INTEGER NOT NULL DEFAULT 0,
    "basketballRecordCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceOccurrenceId" TEXT,
    "sourceSeriesId" TEXT,
    "action" "ImportItemAction" NOT NULL,
    "reviewStatus" "ImportReviewStatus" NOT NULL DEFAULT 'PENDING',
    "runId" TEXT,
    "rawPayload" JSONB,
    "normalizedPayload" JSONB,
    "fieldDiff" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_venue_refs_venueId_idx" ON "external_venue_refs"("venueId");

-- CreateIndex
CREATE INDEX "external_venue_refs_matchStatus_idx" ON "external_venue_refs"("matchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "external_venue_refs_scheduleSourceId_externalId_key" ON "external_venue_refs"("scheduleSourceId", "externalId");

-- CreateIndex
CREATE INDEX "import_batches_scheduleSourceId_startedAt_idx" ON "import_batches"("scheduleSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_items_runId_idx" ON "import_items"("runId");

-- CreateIndex
CREATE INDEX "import_items_action_idx" ON "import_items"("action");

-- CreateIndex
CREATE INDEX "import_items_reviewStatus_idx" ON "import_items"("reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "import_items_batchId_sourceKey_key" ON "import_items"("batchId", "sourceKey");

-- CreateIndex
CREATE INDEX "runs_scheduleSourceId_sourceStatus_idx" ON "runs"("scheduleSourceId", "sourceStatus");

-- CreateIndex
CREATE INDEX "runs_reviewStatus_idx" ON "runs"("reviewStatus");

-- CreateIndex
CREATE INDEX "runs_sourceMissingSince_idx" ON "runs"("sourceMissingSince");

-- CreateIndex
CREATE UNIQUE INDEX "runs_scheduleSourceId_sourceExternalId_key" ON "runs"("scheduleSourceId", "sourceExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_sources_providerKey_key" ON "schedule_sources"("providerKey");

-- AddForeignKey
ALTER TABLE "external_venue_refs" ADD CONSTRAINT "external_venue_refs_scheduleSourceId_fkey" FOREIGN KEY ("scheduleSourceId") REFERENCES "schedule_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_venue_refs" ADD CONSTRAINT "external_venue_refs_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_scheduleSourceId_fkey" FOREIGN KEY ("scheduleSourceId") REFERENCES "schedule_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
