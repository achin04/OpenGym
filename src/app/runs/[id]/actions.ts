"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { rsvpUserToRun, cancelUserRsvp } from "@/server/rsvps";



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

    await rsvpUserToRun({
        userId: appUser.id,
        runId,
    });

    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
}

export async function cancelRsvp(runId: string) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        throw new Error(" You must be signed in to cancel an RSVP. ");
    }

    const appUser = await prisma.user.findUnique({
        where: {
            clerkUserId: clerkUser.id,
        },
        select: {
            id: true,
        },
    });

    if (!appUser) {
        throw new Error(" User not found. ");
    }

    await cancelUserRsvp({
        userId: appUser.id,
        runId,
    });

    revalidatePath(`/runs/${runId}`);
    revalidatePath("/runs");
}