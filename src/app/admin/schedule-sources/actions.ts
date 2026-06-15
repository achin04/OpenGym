"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RunSourceType } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";

const createScheduleSourceSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    sourceType: z.enum(["CITY", "UNIVERSITY"]),
    url: z.string().trim().pipe(z.url("Website must be a valid URL")),
    notes: z.string().trim().optional(),
});

export async function createScheduleSource(formData: FormData) {
    await requireAdmin();

    const result = createScheduleSourceSchema.safeParse({
        name: formData.get("name"),
        sourceType: formData.get("sourceType"),
        url: formData.get("url"),
        notes: formData.get("notes"),
    });
    
    if (!result.success) {
        console.log(z.flattenError(result.error).fieldErrors);
        return;
    }

    const data = result.data;

    await prisma.scheduleSource.create({
        data: {
            name: data.name,
            sourceType: data.sourceType as RunSourceType,
            url: data.url,
            notes: data.notes || null,
        },
    });

    revalidatePath("/admin/schedule-sources");
    revalidatePath("/admin/imported-runs");
}