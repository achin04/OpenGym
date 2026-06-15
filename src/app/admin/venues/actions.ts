"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";

const createVenueSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    addressLine1: z.string().trim().min(1, "Address Line 1 is required"),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    postalCode: z.string().trim().optional(),
    websiteUrl: z.string().trim().pipe(z.url("Website must be a valid URL")).optional().or(z.literal("")),
    phone: z.string().trim().optional(),
});

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
