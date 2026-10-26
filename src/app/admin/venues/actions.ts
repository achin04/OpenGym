"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import {
    createVenueSchema,
    setVenueCoordinatesSchema,
    venueIdSchema,
    type VenueCoordinatesActionState,
} from "@/lib/validations/admin";
import {
    clearVenueCoordinates,
    describeGeocodeMissingResult,
    describeGeocodeResult,
    geocodeMissingVenues,
    geocodeVenueById,
    setVenueCoordinatesManually,
} from "@/server/geocoding/venue-coordinates";

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

    const venue = await prisma.venue.create({
        data: {
            name: data.name,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 || null,
            city: data.city,
            postalCode: data.postalCode || null,
            websiteUrl: data.websiteUrl || null,
            phone: data.phone || null,
        },
        select: { id: true },
    });

    // After the create, not inside it: a failed or slow geocode must never be
    // able to stop a venue from existing.
    await geocodeVenueById(venue.id);

    revalidatePath("/admin/venues");
    revalidatePath("/runs/new");

}

function venueCoordinatesPaths() {
    revalidatePath("/admin/venues");
    // The map reads coordinates, so the home page is stale the moment they
    // change.
    revalidatePath("/");
}

/**
 * Re-runs the geocoder for one venue.
 *
 * Uses refreshAuto rather than force, so a coordinate an admin corrected by
 * hand is reported as skipped instead of being silently overwritten. To
 * genuinely re-geocode such a venue, clear its coordinates first -- two
 * deliberate steps rather than one destructive one.
 */
export async function geocodeVenueAction(
    _previousState: VenueCoordinatesActionState,
    formData: FormData,
): Promise<VenueCoordinatesActionState> {
    await requireAdmin();

    const result = venueIdSchema.safeParse({
        venueId: formData.get("venueId"),
    });

    if (!result.success) {
        return { status: "error", message: "Please choose a venue." };
    }

    const geocodeResult = await geocodeVenueById(result.data.venueId, {
        mode: "refreshAuto",
    });

    venueCoordinatesPaths();

    return {
        status: geocodeResult.status === "ok" ? "success" : "error",
        message: describeGeocodeResult(geocodeResult),
    };
}

export async function setVenueCoordinatesAction(
    _previousState: VenueCoordinatesActionState,
    formData: FormData,
): Promise<VenueCoordinatesActionState> {
    await requireAdmin();

    const result = setVenueCoordinatesSchema.safeParse({
        venueId: formData.get("venueId"),
        latitude: formData.get("latitude"),
        longitude: formData.get("longitude"),
    });

    if (!result.success) {
        const [issue] = result.error.issues;

        return {
            status: "error",
            message: issue?.message ?? "Please check the coordinates.",
        };
    }

    const { venueId, latitude, longitude } = result.data;

    await setVenueCoordinatesManually(venueId, { latitude, longitude });
    venueCoordinatesPaths();

    return {
        status: "success",
        message:
            "Coordinates saved as a manual correction, which a future re-geocode will not overwrite.",
    };
}

export async function clearVenueCoordinatesAction(
    _previousState: VenueCoordinatesActionState,
    formData: FormData,
): Promise<VenueCoordinatesActionState> {
    await requireAdmin();

    const result = venueIdSchema.safeParse({
        venueId: formData.get("venueId"),
    });

    if (!result.success) {
        return { status: "error", message: "Please choose a venue." };
    }

    await clearVenueCoordinates(result.data.venueId);
    venueCoordinatesPaths();

    return {
        status: "success",
        message:
            "Coordinates cleared. This venue is off the map until it is geocoded again.",
    };
}

/**
 * Works through one batch of venues that have no coordinates.
 *
 * Deliberately one batch per click rather than a loop to completion: the
 * function has a wall-clock limit, Nominatim is capped at one request per
 * second, and a run that times out half way would report nothing at all. A
 * batch always returns a result, and the message says how many are left.
 */
export async function geocodeMissingVenuesAction(
    _previousState: VenueCoordinatesActionState,
): Promise<VenueCoordinatesActionState> {
    await requireAdmin();

    const result = await geocodeMissingVenues();
    venueCoordinatesPaths();

    return {
        status: result.errored > 0 ? "error" : "success",
        message: describeGeocodeMissingResult(result),
    };
}