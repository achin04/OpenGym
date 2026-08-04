import { describe, expect, it } from "vitest";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import {
  createVenueFromExternalRefSchema,
  linkExternalVenueRefSchema,
  removeImportedVenueCreationVenueSchema,
  updateImportedVenueCreationVenueSchema,
} from "./action-validation";
import {
  parseImportFieldDiffDisplay,
  parseImportItemPayloadDisplay,
} from "./display-parsing";
import {
  likelyDuplicateVenue,
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

describe("updateImportedVenueCreationVenueSchema", () => {
  const validInput = {
    importedVenueCreationId: "imported_venue_creation_1",
    name: "Updated Venue",
    addressLine1: "10 Updated St.",
    addressLine2: "",
    city: "Toronto",
    postalCode: "m5v0r6",
    websiteUrl: "",
    phone: "",
  };

  it("accepts valid update input and normalizes postal code", () => {
    const result =
      updateImportedVenueCreationVenueSchema.safeParse(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.postalCode).toBe("M5V 0R6");
    }
  });

  it("rejects missing imported venue creation id", () => {
    const result = updateImportedVenueCreationVenueSchema.safeParse({
      ...validInput,
      importedVenueCreationId: " ",
    });

    expect(result.success).toBe(false);
  });
});

describe("removeImportedVenueCreationVenueSchema", () => {
  it("accepts valid remove input", () => {
    const result = removeImportedVenueCreationVenueSchema.safeParse({
      importedVenueCreationId: "imported_venue_creation_1",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing imported venue creation id", () => {
    const result = removeImportedVenueCreationVenueSchema.safeParse({
      importedVenueCreationId: " ",
    });

    expect(result.success).toBe(false);
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

  it("detects likely duplicate venues by city, postal code, and source name or address", () => {
    const existingVenue = {
      name: "Canoe Landing Community Centre",
      addressLine1: "45 Fort York Blvd",
      city: "Toronto",
      postalCode: "m5v0r6",
    };

    expect(
      likelyDuplicateVenue(
        {
          name: "Canoe Landing Community Centre",
          addressLine1: "Different Address",
          city: "toronto",
          postalCode: "M5V 0R6",
        },
        existingVenue,
      ),
    ).toBe(true);
    expect(
      likelyDuplicateVenue(
        {
          name: "Different Name",
          addressLine1: "45 Fort York Blvd.",
          city: "Toronto",
          postalCode: "M5V 0R6",
        },
        existingVenue,
      ),
    ).toBe(true);
  });

  it("does not flag likely duplicates without matching city and postal code", () => {
    const existingVenue = {
      name: "Canoe Landing Community Centre",
      addressLine1: "45 Fort York Blvd",
      city: "Toronto",
      postalCode: "M5V 0R6",
    };

    expect(
      likelyDuplicateVenue(
        {
          name: "Canoe Landing Community Centre",
          addressLine1: "45 Fort York Blvd",
          city: "Mississauga",
          postalCode: "M5V 0R6",
        },
        existingVenue,
      ),
    ).toBe(false);
    expect(
      likelyDuplicateVenue(
        {
          name: "Canoe Landing Community Centre",
          addressLine1: "45 Fort York Blvd",
          city: "Toronto",
          postalCode: null,
        },
        existingVenue,
      ),
    ).toBe(false);
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
      importedVenueCreationId: "imported_venue_creation_1",
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
      importedVenueCreationId: "imported_venue_creation_1",
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
