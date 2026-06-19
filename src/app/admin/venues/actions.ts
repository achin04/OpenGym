"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { createVenueSchema } from "@/lib/validations/admin";

export async function createVenue(formData: FormData) {
    await requireAdmin();

    const result = createVenueSchema.safeParse({
        name: formData.get("name"),
        addressLine1: formData.get("addressLine1"),
        addressLine2: formData.get("addressLine2"),
        city: formData.get("city"),
        postalCode: formData.get("postalCode"),
        websiteUrl: formData.get("websiteUrl"),
        phone: formData.get("phone"),
    });
    
    if (!result.success) {
        console.log(z.flattenError(result.error).fieldErrors);
        return;
    }

    const data = result.data;

    await prisma.venue.create({
        data: {
            name: data.name,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            postalCode: data.postalCode || null,
            websiteUrl: data.websiteUrl || null,
            phone: data.phone || null,
        },
    });

    revalidatePath("/admin/venues");
    revalidatePath("/runs/new");

}
