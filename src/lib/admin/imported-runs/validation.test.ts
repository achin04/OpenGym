import { describe, expect, it } from "vitest";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import {
  createVenueFromExternalRefSchema,
  linkExternalVenueRefSchema,
} from "./action-validation";
import {
  parseImportFieldDiffDisplay,
  parseImportItemPayloadDisplay,
} from "./display-parsing";
import {
  normalizeAdminPostalCode,
  normalizeVenueDuplicatePostalCode,
  normalizeVenueDuplicateText,
} from "./venue-normalization";

describe("linkExternalVenueRefSchema", () => {
  it("accepts valid link input", () => {
    const result = linkExternalVenueRefSchema.safeParse({
      externalVenueRefId: "external_ref_1",
      venueId: "venue_1",
      batchId: "batch_1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing externalVenueRefId", () => {
    const result = linkExternalVenueRefSchema.safeParse({
      externalVenueRefId: "  ",
      venueId: "venue_1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing venueId", () => {
    const result = linkExternalVenueRefSchema.safeParse({
      externalVenueRefId: "external_ref_1",
      venueId: "  ",
    });

    expect(result.success).toBe(false);
  });
});

describe("createVenueFromExternalRefSchema", () => {
  const validInput = {
    externalVenueRefId: "external_ref_1",
    batchId: "batch_1",
    name: "Canoe Landing Community Recreation Centre",
    addressLine1: "45 Fort York Blvd.",
    addressLine2: "",
    city: "Toronto",
    postalCode: "m5v0r6",
    websiteUrl:
      "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=3643",
    phone: "",
  };

  it("accepts valid create input and normalizes postal code", () => {
    const result = createVenueFromExternalRefSchema.safeParse(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.postalCode).toBe("M5V 0R6");
    }
  });

  it("rejects missing required venue fields", () => {
    const result = createVenueFromExternalRefSchema.safeParse({
      ...validInput,
      name: "  ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid source URL", () => {
    const result = createVenueFromExternalRefSchema.safeParse({
      ...validInput,
      websiteUrl: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a blank source URL", () => {
    const result = createVenueFromExternalRefSchema.safeParse({
      ...validInput,
      websiteUrl: "",
    });

    expect(result.success).toBe(true);
  });
});

describe("venue normalization", () => {
  it("formats Canadian postal codes consistently", () => {
    expect(normalizeAdminPostalCode("m5v0r6")).toBe("M5V 0R6");
    expect(normalizeAdminPostalCode("M5V 0R6")).toBe("M5V 0R6");
  });

  it("normalizes text used for duplicate checks", () => {
    expect(normalizeVenueDuplicateText("  45  Fort York Blvd. ")).toBe(
      "45 fort york blvd",
    );
  });

  it("returns null duplicate keys for blank text and postal codes", () => {
    expect(normalizeVenueDuplicateText(" ")).toBeNull();
    expect(normalizeVenueDuplicatePostalCode(" ")).toBeNull();
  });
});

describe("display parsing", () => {
  it("parses valid normalized payload display fields", () => {
    const payload = parseImportItemPayloadDisplay({
      title: "Basketball",
      startTime: "2026-06-21T14:45:00.000Z",
      endTime: "2026-06-21T16:30:00.000Z",
      sourceLocationId: "3643",
      externalVenueRefId: "external_ref_1",
      venueMatchStatus: VenueMatchStatus.PENDING,
      venueMatchReason: "no_exact_match",
      location: {
        sourceLocationId: "3643",
        sourceName: "Canoe Landing Community Recreation Centre",
        sourceAddressLine1: "45 Fort York Blvd.",
        sourcePostalCode: "M5V 0R6",
        sourceUrl:
          "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=3643",
      },
    });

    expect(payload).toMatchObject({
      title: "Basketball",
      sourceLocationId: "3643",
      externalVenueRefId: "external_ref_1",
      venueMatchStatus: VenueMatchStatus.PENDING,
    });
  });

  it("returns null for malformed normalized payloads", () => {
    expect(parseImportItemPayloadDisplay("not-json-object")).toBeNull();
  });

  it("parses valid field diffs", () => {
    expect(
      parseImportFieldDiffDisplay([
        {
          field: "title",
          current: "Old title",
          proposed: "Basketball",
        },
      ]),
    ).toEqual([
      {
        field: "title",
        current: "Old title",
        proposed: "Basketball",
      },
    ]);
  });

  it("returns an empty list for malformed field diffs", () => {
    expect(parseImportFieldDiffDisplay({ field: "title" })).toEqual([]);
  });
});
