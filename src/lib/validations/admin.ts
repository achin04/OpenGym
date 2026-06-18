import { z } from "zod";

export const createVenueSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required"),
        addressLine1: z.string().trim().min(1, "Address Line 1 is required"),
        addressLine2: z.string().trim().optional(),
        city: z.string().trim().min(1, "City is required"),
        postalCode: z.string().trim().optional(),
        websiteUrl: z
            .string()
            .trim()
            .pipe(z.url("Website must be a valid URL"))
            .optional()
            .or(z.literal("")),
        phone: z.string().trim().optional(),
});

export const createScheduleSourceSchema = z
    .object({
        name: z.string().trim().min(1, "Name is required"),
        sourceType: z.enum(["CITY", "UNIVERSITY"]),
        url: z.string().trim().pipe(z.url("Website must be a valid URL")),
        notes: z.string().trim().optional(),
});