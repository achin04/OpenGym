import { describe, it, expect } from "vitest" ;
import { createRunSchema } from "./runs" ;

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

    it("rejects a negative max players", () => {
        const result = createRunSchema.safeParse({
            ...validCreateRunInput,
            maxPlayers: "-3",
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