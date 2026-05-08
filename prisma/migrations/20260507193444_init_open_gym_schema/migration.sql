-- CreateEnum
CREATE TYPE "RunSourceType" AS ENUM ('CITY', 'UNIVERSITY', 'USER');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'OPEN');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('ALL_AGES', 'YOUTH', 'ADULT', 'SENIOR');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'WAITLISTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "websiteUrl" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "RunSourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "RunSourceType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(10,2),
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'OPEN',
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'ADULT',
    "maxPlayers" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "venueId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "scheduleSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "venues_city_state_idx" ON "venues"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_sources_url_key" ON "schedule_sources"("url");

-- CreateIndex
CREATE INDEX "schedule_sources_sourceType_idx" ON "schedule_sources"("sourceType");

-- CreateIndex
CREATE INDEX "runs_startTime_idx" ON "runs"("startTime");

-- CreateIndex
CREATE INDEX "runs_venueId_startTime_idx" ON "runs"("venueId", "startTime");

-- CreateIndex
CREATE INDEX "runs_sourceType_idx" ON "runs"("sourceType");

-- CreateIndex
CREATE INDEX "runs_createdByUserId_idx" ON "runs"("createdByUserId");

-- CreateIndex
CREATE INDEX "runs_scheduleSourceId_idx" ON "runs"("scheduleSourceId");

-- CreateIndex
CREATE INDEX "rsvps_runId_idx" ON "rsvps"("runId");

-- CreateIndex
CREATE INDEX "rsvps_status_idx" ON "rsvps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_userId_runId_key" ON "rsvps"("userId", "runId");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_scheduleSourceId_fkey" FOREIGN KEY ("scheduleSourceId") REFERENCES "schedule_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
