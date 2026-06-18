import { z } from "zod" ;

export const createRunSchema = z
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
                message: "Price must be 0 or a positive number",
            })
            .optional(),
        maxPlayers: z
            .string()
            .trim()
            .refine((value) => value === "" || Number(value) > 0, {
                message: "Max players must be a positive number",
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
    
export const createImportedRunSchema = z
    .object({
        title: z.string().trim().min(1, "Title is required"),
        venueId: z.string().trim().min(1, "Venue is required"),
        scheduleSourceId: z.string().trim().min(1, "Schedule source is required"),
        sourceUrl: z.url("Source URL must be a valid URL"),
        startTime: z.string().trim().min(1, "Start time is required"),
        endTime: z.string().trim().min(1, "End time is required"),
        description: z.string().trim().optional(),
        price: z
            .string()
            .trim()
            .refine((value) => value === "" || Number(value) >= 0, {
                message: "Price must be 0 or a positive number",
            })
            .optional(),
        maxPlayers: z
            .string()
            .trim()
            .refine((value) => value === "" || Number(value) > 0, {
                message: "Max players must be a positive number",
            })
            .optional(),
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
