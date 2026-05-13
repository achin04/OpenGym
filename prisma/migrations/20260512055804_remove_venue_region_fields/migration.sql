/*
  Warnings:

  - You are about to drop the column `country` on the `venues` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `venues` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "venues_city_state_idx";

-- AlterTable
ALTER TABLE "venues" DROP COLUMN "country",
DROP COLUMN "state";

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");
