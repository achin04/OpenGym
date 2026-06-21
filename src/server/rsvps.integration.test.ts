import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { RsvpStatus, RunSourceType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { rsvpUserToRun, cancelUserRsvp } from "@/server/rsvps";

async function cleanDatabase() {
  await prisma.rsvp.deleteMany();
  await prisma.run.deleteMany();
  await prisma.scheduleSource.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

async function createVenue() {
  return prisma.venue.create({
    data: {
      name: "Integration Test Gym",
      addressLine1: "123 Test St",
      city: "Toronto",
    },
  });
}

async function createUser(email: string) {
  return prisma.user.create({
    data: {
      clerkUserId: `clerk_${email}`,
      email,
      name: "Test User",
    },
  });
}

describe("rsvpUserToRun", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it("creates a GOING RSVP for a run with capacity", async () => {
    const venue = await createVenue();
    const user = await createUser("going@example.com");

    const run = await prisma.run.create({
      data: {
        title: "Integration pickup",
        sourceType: RunSourceType.USER,
        startTime: new Date("2026-06-20T18:00:00.000Z"),
        endTime: new Date("2026-06-20T20:00:00.000Z"),
        maxPlayers: 1,
        venueId: venue.id,
        createdByUserId: user.id,
      },
    });

    await rsvpUserToRun({
      userId: user.id,
      runId: run.id,
    });

    const rsvp = await prisma.rsvp.findUnique({
      where: {
        userId_runId: {
          userId: user.id,
          runId: run.id,
        },
      },
    });

    expect(rsvp?.status).toBe(RsvpStatus.GOING);
  });

  it("rejects a new RSVP when the run is full", async () => {
    const venue = await createVenue();
    const firstUser = await createUser("first@example.com");
    const secondUser = await createUser("second@example.com");

    const run = await prisma.run.create({
      data: {
        title: "Full integration pickup",
        sourceType: RunSourceType.USER,
        startTime: new Date("2026-06-20T18:00:00.000Z"),
        endTime: new Date("2026-06-20T20:00:00.000Z"),
        maxPlayers: 1,
        venueId: venue.id,
        createdByUserId: firstUser.id,
      },
    });

    await rsvpUserToRun({
      userId: firstUser.id,
      runId: run.id,
    });

    await expect(
      rsvpUserToRun({
        userId: secondUser.id,
        runId: run.id,
      }),
    ).rejects.toThrow("This run is full");

    const goingCount = await prisma.rsvp.count({
      where: {
        runId: run.id,
        status: RsvpStatus.GOING,
      },
    });

    expect(goingCount).toBe(1);
  });

  it("does not create a duplicate RSVP when the user is already going", async () => {
    const venue = await createVenue();
    const user = await createUser("duplicate@example.com");

    const run = await prisma.run.create({
        data: {
        title: "Duplicate RSVP pickup",
        sourceType: RunSourceType.USER,
        startTime: new Date("2026-06-20T18:00:00.000Z"),
        endTime: new Date("2026-06-20T20:00:00.000Z"),
        maxPlayers: 10,
        venueId: venue.id,
        createdByUserId: user.id,
        },
    });

    await rsvpUserToRun({
        userId: user.id,
        runId: run.id,
    });

    await rsvpUserToRun({
        userId: user.id,
        runId: run.id,
    });

    const rsvpCount = await prisma.rsvp.count({
        where: {
        userId: user.id,
        runId: run.id,
        },
    });

    expect(rsvpCount).toBe(1);
    });

    it("cancels an GOING RSVP", async () => {
        const venue = await createVenue();
        const user = await createUser("cancel@example.com");

        const run = await prisma.run.create({
            data: {
                title: "Cancel RSVP pickup",
                sourceType: RunSourceType.USER,
                startTime: new Date("2026-06-20T18:00:00.000Z"),
                endTime: new Date("2026-06-20T20:00:00.000Z"),
                maxPlayers: 10,
                venueId: venue.id,
                createdByUserId: user.id,
            },
        });

        await rsvpUserToRun({
            userId: user.id,
            runId: run.id,
        });

        await cancelUserRsvp({
            userId: user.id,
            runId: run.id,
        });

        const rsvp = await prisma.rsvp.findUnique({
            where: {
                userId_runId: {
                    userId: user.id,
                    runId: run.id,
                },
            },
        });

        expect(rsvp?.status).toBe(RsvpStatus.CANCELLED);

        const goingCount = await prisma.rsvp.count({
            where: {
                runId: run.id,
                status: RsvpStatus.GOING,
            },
        });

        expect(goingCount).toBe(0);
    });

    it("allows a cancelled RSVP to become GOING again when capacity is available", async () => {
        const venue = await createVenue();
        const user = await createUser("return@example.com");

        const run = await prisma.run.create({
            data: {
            title: "Return RSVP pickup",
            sourceType: RunSourceType.USER,
            startTime: new Date("2026-06-20T18:00:00.000Z"),
            endTime: new Date("2026-06-20T20:00:00.000Z"),
            maxPlayers: 1,
            venueId: venue.id,
            createdByUserId: user.id,
            },
        });

        await rsvpUserToRun({
            userId: user.id,
            runId: run.id,
        });

        await cancelUserRsvp({
            userId: user.id,
            runId: run.id,
        });

        await rsvpUserToRun({
            userId: user.id,
            runId: run.id,
        });

        const rsvp = await prisma.rsvp.findUnique({
            where: {
            userId_runId: {
                userId: user.id,
                runId: run.id,
            },
            },
        });

        expect(rsvp?.status).toBe(RsvpStatus.GOING);

        const rsvpCount = await prisma.rsvp.count({
            where: {
            userId: user.id,
            runId: run.id,
            },
        });

        expect(rsvpCount).toBe(1);
    });

    it("rejects an RSVP for a missing run", async () => {
        const user = await createUser("missing-run@example.com");

        await expect(
            rsvpUserToRun({
            userId: user.id,
            runId: "missing_run_id",
            }),
        ).rejects.toThrow("Run not found");
    });

});