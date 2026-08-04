-- CreateTable
CREATE TABLE "imported_venue_creations" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "externalVenueRefId" TEXT NOT NULL,
    "venueId" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceAddressLine1" TEXT,
    "sourcePostalCode" TEXT,
    "sourceUrl" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_venue_creations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_venue_creations_externalVenueRefId_key" ON "imported_venue_creations"("externalVenueRefId");

-- CreateIndex
CREATE INDEX "imported_venue_creations_batchId_idx" ON "imported_venue_creations"("batchId");

-- CreateIndex
CREATE INDEX "imported_venue_creations_venueId_idx" ON "imported_venue_creations"("venueId");

-- CreateIndex
CREATE INDEX "imported_venue_creations_createdAt_idx" ON "imported_venue_creations"("createdAt");

-- AddForeignKey
ALTER TABLE "imported_venue_creations" ADD CONSTRAINT "imported_venue_creations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_venue_creations" ADD CONSTRAINT "imported_venue_creations_externalVenueRefId_fkey" FOREIGN KEY ("externalVenueRefId") REFERENCES "external_venue_refs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_venue_creations" ADD CONSTRAINT "imported_venue_creations_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
