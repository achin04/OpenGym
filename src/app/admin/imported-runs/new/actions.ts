"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";

const createImportedRunSchema = z
    .object({
        title: z.string().trim().min(1, "Title is required"),
        venueId: z.string().trim().min(1, "Venue is required"),
        scheduleSourceId: z.string().trim().min(1, "Schedule source is required"),
        sourceUrl: z.url("Source URL must be a valid URL"),
        startTime: z.string().trim().min(1, "Start time is required"),
        endTime: z.string().trim().min(1, "End time is required"),
        description: z.string().trim().optional(),
        price: z.string().trim().optional(),
        maxPlayers: z.string().trim().optional(),
        skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "OPEN"]),
        ageGroup: z.enum(["ALL_AGES", "YOUTH", "ADULT", "SENIOR"]),
    })
    .refine(
        (data) =>  new Date(data.endTime) > new Date(data.startTime),
        {
            message: "End time must be after start time",
            path: ["endTime"]
        },
    );

export async function createImportedRun(formData: FormData) {
    await requireAdmin();

    const result = createImportedRunSchema.safeParse({
        title: formData.get("title"),
        venueId: formData.get("venueId"),
        scheduleSourceId: formData.get("scheduleSourceId"),
        sourceUrl: formData.get("sourceUrl"),
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

    const data = result.data;

    const venue = await prisma.venue.findUnique({
        where: { id: data.venueId },
        select: { id: true }
    });

    if (!venue) {
        console.log({ venueId: ["Selected venue does not exist"] });
        return;
    }

    const scheduleSource = await prisma.scheduleSource.findUnique({
        where: { id: data.scheduleSourceId },
        select: {
            id: true,
            sourceType: true,
        }
    });

    if (!scheduleSource) {
        console.log({ scheduleSourceId: ["Selected schedule source does not exist"] });
        return;
    }

    const run = await prisma.run.create({
        data: {
            title: data.title,
            description: data.description || null,
            sourceType: scheduleSource.sourceType,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            price: data.price || null,
            skillLevel: data.skillLevel,
            ageGroup: data.ageGroup,
            maxPlayers: data.maxPlayers ? Number(data.maxPlayers) : null,
            verified: true,
            sourceUrl: data.sourceUrl,
            venueId: data.venueId,
            createdByUserId: null,
            scheduleSourceId: scheduleSource.id,
        },
        select: {
            id: true,
        },
    });

    revalidatePath("/runs");
    revalidatePath(`/runs/${run.id}`);
    revalidatePath("/admin/imported-runs,new");

    redirect(`/runs/${run.id}`);
}

