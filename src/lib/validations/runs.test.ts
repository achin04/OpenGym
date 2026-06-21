import { describe, it, expect } from "vitest" ;
import { createRunSchema, createImportedRunSchema } from "./runs" ;

const validCreateRunInput = {
    title: "Friday night pickup",
    venueId: "123",
    startTime: "2024-07-01T19:00",
    endTime: "2024-07-01T21:00",
    description: "",
    price: "",
    maxPlayers: "12",
    skillLevel: "OPEN",
    ageGroup: "ADULT",
};

const validCreateImportedRunInput = {
    title: "City drop-in basketball",
    venueId: "venue_123",
    scheduleSourceId: "source_123",
    sourceUrl: "https://example.com/basketball",
    startTime: "2026-06-20T18:00",
    endTime: "2026-06-20T20:00",
    description: "",
    price: "",
    maxPlayers: "",
    skillLevel: "OPEN",
    ageGroup: "ADULT",
};

describe("createRunSchema", () => {
    it("accepts a valid run", () => {
        const result = createRunSchema.safeParse(validCreateRunInput);
        expect(result.success).toBe(true);
    });

    it("rejects a run with end time before start time", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            endTime: "2024-07-01T18:00",
        });
        expect(result.success).toBe(false);
    });

    it("rejects a missing title", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            title: "  ",
        });
        expect(result.success).toBe(false);
    });

    it("rejects a negative price", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            price: "-5",
        });
        expect(result.success).toBe(false);
    });

    it("trims text fields", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            title: "  Friday night pickup  ",
        });
        expect(result.success).toBe(true);

    if (result.success) {
        expect(result.data.title).toBe("Friday night pickup");
    }
    });

    it("allows an empty optional price", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            price: "",
        });
        expect(result.success).toBe(true);
    });

    it("allows a zero price", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            price: "0",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a negative max players value", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            maxPlayers: "-1",
     });
        expect(result.success).toBe(false);
    });

    it("rejects zero max players", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            maxPlayers: "0",
        });
        expect(result.success).toBe(false);
    });
});

describe("createImportedRunSchema", () => {
    it("accepts a valid imported run", () => {
        const result = createImportedRunSchema.safeParse(validCreateImportedRunInput);
        expect(result.success).toBe(true);
    });

    it("rejects an invalid URL", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            sourceUrl: "not-a-valid-url",
        });
        expect(result.success).toBe(false);
    });

    it("rejects a missing schedule source ID", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            scheduleSourceId: "  ",
        });
        expect(result.success).toBe(false);
    });

    it("rejects an end time before start time", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            endTime: "2026-06-20T17:00",
        });
        expect(result.success).toBe(false);
    });

    it("allows a zero price", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            price: "0",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a negative price", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            price: "-5",
        });
        expect(result.success).toBe(false);
    });

    it("rejects zero max players", () => {
        const result = createImportedRunSchema.safeParse({
            ...validCreateImportedRunInput,
            maxPlayers: "0",
        });
        expect(result.success).toBe(false);
    });

});