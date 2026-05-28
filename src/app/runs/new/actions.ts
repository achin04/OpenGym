"use server";

import { currentUser } from "@clerk/nextjs/server" ;

export async function createRun(formData: FormData) {
    const clerkUser = await currentUser();

    if (!clerkUser) {
        throw new Error(" You must be signed in to create a run. ");
    }

    console.log({
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
}