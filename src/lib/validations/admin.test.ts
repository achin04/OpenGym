import { describe, it, expect } from "vitest" ;
import { createVenueSchema, createScheduleSourceSchema } from "./admin";

const validVenueInput = {
    name: "Downtown Gym",
    addressLine1: "123 Main St",
    city: "Metropolis",
    postalCode: "12345",
    websiteUrl: "https://downtowngym.com",
    phone: "555-1234",
};

const validScheduleSourceInput = {
    name: "City Sports League",
    sourceType: "CITY",
    url: "https://citysportsleague.com/schedule",
    notes: "Seasonal schedule for city leagues",
};

describe("createVenueSchema", () => {
    it("accepts valid input", () => {
        const result = createVenueSchema.safeParse(validVenueInput);
        expect(result.success).toBe(true);
    });
    
    it("rejects missing required fields", () => {
        const result = createVenueSchema.safeParse({
            ...validVenueInput,
            name: "  ",
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid website URL", () => {
        const result = createVenueSchema.safeParse({
            ...validVenueInput,
            websiteUrl: "not-a-url",
        });
        expect(result.success).toBe(false);
    });

    it("accepts blank URL", () => {
        const result = createVenueSchema.safeParse({
            ...validVenueInput,
            websiteUrl: "",
        });
        expect(result.success).toBe(true);
    });
});

describe("createScheduleSourceSchema", () => {
    it("accepts valid input", () => {
        const result = createScheduleSourceSchema.safeParse(validScheduleSourceInput);
        expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
        const result = createScheduleSourceSchema.safeParse({
            ...validScheduleSourceInput,
            name: "  ",
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid URL", () => {
        const result = createScheduleSourceSchema.safeParse({
            ...validScheduleSourceInput,
            url: "not-a-url",
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid source type", () => {
        const result = createScheduleSourceSchema.safeParse({
            ...validScheduleSourceInput,
            sourceType: "USER",
        });
        expect(result.success).toBe(false);
    });
});