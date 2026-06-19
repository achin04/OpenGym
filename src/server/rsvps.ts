import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { RsvpStatus } from "@/generated/prisma/enums";

export async function rsvpUserToRun({
    userId,
    runId,
}: {
    userId: string;
    runId: string;
}) {
    await prisma.$transaction(
        async (tx) => {
            const run = await tx.run.findUnique({
                where: {
                    id: runId,
                },
                select: {
                    id: true,
                    maxPlayers: true,
                },
            });

            if (!run) {
                throw new Error(" Run not found. ");
            }

            const existingRsvp = await tx.rsvp.findUnique({
                where: {
                    userId_runId: {
                        userId,
                        runId,
                    },
                },
                select: {
                    status: true,
                },
            });

            if (existingRsvp?.status === RsvpStatus.GOING) {
                return;
            }
            
            if (run.maxPlayers != null) {
                const goingCount = await tx.rsvp.count({
                    where: {
                        runId,
                        status: RsvpStatus.GOING,
                    },
                });

                if (goingCount >= run.maxPlayers) {
                    throw new Error(" This run is full ");
                }
            }
            
            await tx.rsvp.upsert({
                where: {
                    userId_runId: {
                        userId,
                        runId,
                    },
                },
                update: {
                    status: RsvpStatus.GOING,
                },
                create: {
                    userId,
                    runId,
                    status: RsvpStatus.GOING,
                },
            });
        },
        {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
    );
}

export async function cancelUserRsvp({
    userId,
    runId,
}: {
    userId: string;
    runId: string;
}) {
    await prisma.rsvp.updateMany({
        where: {
            userId,
            runId,
            status: RsvpStatus.GOING,
        },
        data: {
            status: RsvpStatus.CANCELLED,
        },
    });
}