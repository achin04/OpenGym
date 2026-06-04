"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { RsvpStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";


export async function rsvpToRun(runId: string) {
    const clerkUser = await currentUser();
    
    if (!clerkUser) {
        throw new Error(" You must be signed in to RSVP. ");
    }

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    
    if (!email) {
        throw new Error(" Expected user to have a primary email address. ");
    }

    const appUser = await prisma.user.upsert({
        where: {
            clerkUserId: clerkUser.id,
        },
        update: {
            email: email,
            name: clerkUser.fullName,
        },
        create: {
            clerkUserId: clerkUser.id,
            email: email,
            name: clerkUser.fullName,
        },
    });

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
                        userId: appUser.id,
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
                        userId: appUser.id,
                        runId,
                    },
                },
                update: {
                    status: RsvpStatus.GOING,
                },
                create: {
                    userId: appUser.id,
                    runId,
                    status: RsvpStatus.GOING,
                },
            });
        },
        {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
    );

    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
}