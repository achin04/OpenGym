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

/**
 * Action state for the venue-coordinate controls.
 *
 * Deliberately a separate type from the imported-runs AdminActionState, which
 * has the same shape: /admin/venues has nothing to do with the import
 * pipeline, and importing that module here would tell a reader otherwise. Four
 * duplicated lines are cheaper than a misleading dependency.
 */
export type VenueCoordinatesActionState = {
    status: "idle" | "success" | "error";
    message: string;
};

export const initialVenueCoordinatesActionState: VenueCoordinatesActionState = {
    status: "idle",
    message: "",
};

export const venueIdSchema = z.object({
    venueId: z.string().trim().min(1, "Venue is required"),
});

export const setVenueCoordinatesSchema = z.object({
    venueId: z.string().trim().min(1, "Venue is required"),
    // Coerced because these arrive as form strings. The ranges are the real
    // coordinate domain, not a Toronto-specific guard -- a transposed pair
    // (lat/lng swapped) is the mistake this actually catches, since a Toronto
    // longitude of -79 is not a valid latitude.
    latitude: z.coerce
        .number("Latitude must be a number")
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce
        .number("Longitude must be a number")
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
});
