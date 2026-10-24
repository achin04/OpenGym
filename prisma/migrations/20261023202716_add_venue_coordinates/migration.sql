-- CreateEnum
CREATE TYPE "GeocodeSource" AS ENUM ('NOMINATIM', 'MANUAL');

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "geocodeSource" "GeocodeSource",
ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
