"use server";

import { currentUser } from "@clerk/nextjs/server" ;
import { z } from "zod" ;
import { prisma } from "@/server/db" ;
import { revalidatePath } from "next/cache" ;
import { redirect } from "next/navigation" ;
import { RunSourceType } from "@/generated/prisma/enums";

const createRunSchema = z
    .object({
        title: z.string().trim().min(1, "Title is required"),
        venueId: z.string().trim().min(1, "Venue is required"),
        startTime: z.string().trim().min(1, "Start time is required"),
        endTime: z.string().trim().min(1, "End time is required"),
        description: z.string().trim().optional(),
        price: z
            .string()
            .trim()
            .refine((value) => value === "" || Number(value) >= 0, {
                message: "Price must be 0 or greater",
            })
            .optional(),
        maxPlayers: z
            .string()
            .trim()
            .refine((value) => value === "" || Number(value) >= 0, {
                message: "Max players must be 0 or greater",
            })
            .optional(),
        skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "OPEN"]),
        ageGroup: z.enum(["ALL_AGES", "YOUTH", "ADULT", "SENIOR"]),
    })
    .refine(
        (data) => {
            const startTime = new Date(data.startTime);
            const endTime = new Date(data.endTime);
            return endTime > startTime;
        },
        {
            message: "End time must be after start time",
            path: ["endTime"],
        },
    );

export async function createRun(formData: FormData) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        throw new Error(" You must be signed in to create a run. ");
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
            email,
            name: clerkUser.fullName,
        },
        create: {
            clerkUserId: clerkUser.id,
            email,
            name: clerkUser.fullName,
        },
    });

    const result = createRunSchema.safeParse({
        title: formData.get("title"),
        venueId: formData.get("venueId"),
        startTime: formData.get("startTime"),
        endTime: formData.get("endTime"),
        description: formData.get("description"),
        price: formData.get("price"),
        maxPlayers: formData.get("maxPlayers"),
        skillLevel: formData.get("skillLevel"),
        ageGroup: formData.get("ageGroup"),
    });

    if (!result.success) {
        console.log(z.flattenError(result.error).fieldErrors);
        return;
    }

    const venue = await prisma.venue.findUnique({
        where: {
            id: result.data.venueId,
        },
        select: {
            id: true,
        },
    });

    if (!venue) {
        console.log({
            venueId: ["Selected venue does not exist"],
        });
        return;
    }

    const data  = result.data;

    const run = await prisma.run.create({
        data: {
            title: data.title,
            description: data.description || null,
            sourceType: RunSourceType.USER,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            price: data.price || null,
            skillLevel: data.skillLevel,
            ageGroup: data.ageGroup,
            maxPlayers: data.maxPlayers ? Number(data.maxPlayers) : null,
            verified: false,
            sourceUrl: null,
            venueId: data.venueId,
            createdByUserId: appUser.id,
        },
        select: {
            id: true,
        },
    });

    revalidatePath("/runs");
    redirect(`/runs/${run.id}`);
}