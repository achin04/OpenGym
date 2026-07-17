import { describe, expect, it } from "vitest";
import {
  AgeGroup,
  RunSourceType,
  SkillLevel,
  VenueMatchStatus,
} from "@/generated/prisma/enums";
import dropInFixture from "../../../../tests/fixtures/toronto/drop-in-sample.json";
import locationsFixture from "../../../../tests/fixtures/toronto/locations-sample.json";
import {
  isTorontoBasketballDropInRow,
  matchTorontoVenue,
  normalizeTorontoDropInRunCandidate,
  normalizeTorontoDropInRunCandidates,
  normalizeTorontoLocationRow,
  normalizeTorontoPostalCode,
  normalizeTorontoSourceText,
  parseTorontoLocalDateTime,
  torontoDropInRowSchema,
  torontoLocationRowSchema,
  type TorontoDropInRow,
  type TorontoLocationRow,
  type TorontoVenueMatchCandidate,
} from "./normalization";

type TorontoDropInFixture = {
  sampleRecords: unknown[];
  basketballRecords: unknown[];
};

type TorontoLocationsFixture = {
  sampleRecords: unknown[];
};

const fixture = dropInFixture as TorontoDropInFixture;
const locations = locationsFixture as TorontoLocationsFixture;
const firstBasketballRawRecord = fixture.basketballRecords[0] as Record<
  string,
  unknown
>;

function parseFixtureRow(rawSource: unknown): TorontoDropInRow {
  return torontoDropInRowSchema.parse(rawSource);
}

function parseLocationFixtureRow(rawSource: unknown): TorontoLocationRow {
  return torontoLocationRowSchema.parse(rawSource);
}

const firstBasketballRow = parseFixtureRow(firstBasketballRawRecord);

function findLocationFixtureRow(locationId: number): TorontoLocationRow {
  const rawLocation = locations.sampleRecords.find((record) => {
    return (
      typeof record === "object" &&
      record !== null &&
      "Location ID" in record &&
      record["Location ID"] === locationId
    );
  });

  return parseLocationFixtureRow(rawLocation);
}

describe("torontoDropInRowSchema", () => {
  it("parses representative fixture rows", () => {
    const result = torontoDropInRowSchema.safeParse(fixture.basketballRecords[0]);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data["Course Title"]).toBe("Basketball");
      expect(result.data["Location ID"]).toBe(329);
      expect(result.data.Course_ID).toBe(127611);
    }
  });

  it("coerces numeric strings from source rows", () => {
    const result = torontoDropInRowSchema.parse({
      ...firstBasketballRawRecord,
      _id: "122",
      "Location ID": "329",
      Course_ID: "127611",
      "Start Hour": "10",
      "Start Minute": "45",
      "End Hour": "12",
      "End Min": "30",
    });

    expect(result._id).toBe(122);
    expect(result["Location ID"]).toBe(329);
    expect(result.Course_ID).toBe(127611);
    expect(result["Start Hour"]).toBe(10);
  });
});

describe("torontoLocationRowSchema", () => {
  it("parses representative fixture rows", () => {
    const result = torontoLocationRowSchema.safeParse(locations.sampleRecords[0]);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data["Location Name"]).toBe(
        "John Innes Community Recreation Centre",
      );
      expect(result.data["Location ID"]).toBe(63);
    }
  });

  it("coerces numeric strings from source rows", () => {
    const rawLocation = locations.sampleRecords[0] as Record<string, unknown>;
    const result = torontoLocationRowSchema.parse({
      ...rawLocation,
      _id: "57",
      "Location ID": "63",
      "Parent Location ID": "177",
    });

    expect(result._id).toBe(57);
    expect(result["Location ID"]).toBe(63);
    expect(result["Parent Location ID"]).toBe(177);
  });
});

describe("normalizeTorontoSourceText", () => {
  it("trims, collapses whitespace, and removes source sentinel values", () => {
    expect(normalizeTorontoSourceText("  East   York  ")).toBe("East York");
    expect(normalizeTorontoSourceText("None")).toBeNull();
    expect(normalizeTorontoSourceText(" none ")).toBeNull();
    expect(normalizeTorontoSourceText("   ")).toBeNull();
  });
});

describe("normalizeTorontoPostalCode", () => {
  it("formats Canadian postal codes consistently", () => {
    expect(normalizeTorontoPostalCode("M1V4P1")).toBe("M1V 4P1");
    expect(normalizeTorontoPostalCode("m5a 2r6")).toBe("M5A 2R6");
  });

  it("removes source sentinel postal codes", () => {
    expect(normalizeTorontoPostalCode("None")).toBeNull();
    expect(normalizeTorontoPostalCode(" ")).toBeNull();
  });
});

describe("normalizeTorontoLocationRow", () => {
  it("normalizes a representative location row", () => {
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(329));

    expect(location).toMatchObject({
      sourceLocationId: "329",
      sourceName: "East York Community Recreation Centre",
      sourceAddressLine1: "1081 1/2 Pape Ave",
      sourcePostalCode: null,
      sourceUrl:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
    });
  });

  it("normalizes street directions and compact postal codes", () => {
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(1463));

    expect(location.sourceAddressLine1).toBe("131 Finch Ave W");
    expect(location.sourcePostalCode).toBe("M2N 2H8");
  });

  it("handles source street names that already include a type suffix", () => {
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(3643));

    expect(location.sourceAddressLine1).toBe("45 Fort York Blvd.");
    expect(location.sourcePostalCode).toBe("M5V 0R6");
  });
});

describe("matchTorontoVenue", () => {
  const eastYorkLocation = normalizeTorontoLocationRow(findLocationFixtureRow(329));

  function venue(
    overrides: Partial<TorontoVenueMatchCandidate> = {},
  ): TorontoVenueMatchCandidate {
    return {
      id: "venue_1",
      name: "East York Community Recreation Centre",
      addressLine1: "1081 1/2 Pape Ave",
      city: "Toronto",
      postalCode: null,
      ...overrides,
    };
  }

  it("matches exactly by normalized name, address, and city", () => {
    const result = matchTorontoVenue(eastYorkLocation, [
      venue({
        name: " east york community recreation centre ",
        addressLine1: "1081 1/2 Pape Ave.",
        city: "toronto",
      }),
    ]);

    expect(result).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: "venue_1",
      reason: "exact_name_address",
    });
  });

  it("does not match when the name differs", () => {
    const result = matchTorontoVenue(eastYorkLocation, [
      venue({ name: "East York Community Centre" }),
    ]);

    expect(result).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "no_exact_match",
    });
  });

  it("does not match when the address differs", () => {
    const result = matchTorontoVenue(eastYorkLocation, [
      venue({ addressLine1: "1081 Pape Ave" }),
    ]);

    expect(result).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "no_exact_match",
    });
  });

  it("requires Toronto as the venue city", () => {
    const result = matchTorontoVenue(eastYorkLocation, [
      venue({ city: "East York" }),
    ]);

    expect(result).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "no_exact_match",
    });
  });

  it("requires postal codes to agree when both source and venue have one", () => {
    const location = normalizeTorontoLocationRow(findLocationFixtureRow(405));

    expect(
      matchTorontoVenue(location, [
        venue({
          id: "venue_405",
          name: "Milliken Park Community Recreation Centre",
          addressLine1: "4325 Mccowan Rd",
          postalCode: "M1V 4P1",
        }),
      ]),
    ).toMatchObject({
      status: VenueMatchStatus.MATCHED,
      venueId: "venue_405",
    });

    expect(
      matchTorontoVenue(location, [
        venue({
          id: "venue_405",
          name: "Milliken Park Community Recreation Centre",
          addressLine1: "4325 Mccowan Rd",
          postalCode: "M1V 4P2",
        }),
      ]),
    ).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "no_exact_match",
    });
  });

  it("leaves ambiguous exact matches pending", () => {
    const result = matchTorontoVenue(eastYorkLocation, [
      venue({ id: "venue_1" }),
      venue({ id: "venue_2" }),
    ]);

    expect(result).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "multiple_exact_matches",
    });
  });

  it("leaves locations without source addresses pending", () => {
    const result = matchTorontoVenue(
      {
        ...eastYorkLocation,
        sourceAddressLine1: null,
      },
      [venue()],
    );

    expect(result).toEqual({
      status: VenueMatchStatus.PENDING,
      venueId: null,
      reason: "missing_source_address",
    });
  });
});

describe("isTorontoBasketballDropInRow", () => {
  it("matches known basketball title variants", () => {
    const titles = new Set(
      fixture.basketballRecords.map((record) => {
        return parseFixtureRow(record)["Course Title"];
      }),
    );

    expect(titles).toEqual(
      new Set([
        "Basketball",
        "Basketball (Girls)",
        "Basketball (Men)",
        "Basketball (Women)",
        "Basketball with Family",
        "Parasport: Wheelchair Basketball",
      ]),
    );

    for (const record of fixture.basketballRecords) {
      expect(isTorontoBasketballDropInRow(parseFixtureRow(record))).toBe(true);
    }
  });

  it("does not match non-basketball rows", () => {
    const nonBasketballRow = parseFixtureRow(fixture.sampleRecords[0]);

    expect(nonBasketballRow["Course Title"]).toBe("Pilates with Baby");
    expect(isTorontoBasketballDropInRow(nonBasketballRow)).toBe(false);
  });
});

describe("parseTorontoLocalDateTime", () => {
  it("converts Toronto-local daylight saving time to UTC", () => {
    const date = parseTorontoLocalDateTime("2026-06-21", 10, 45);

    expect(date.toISOString()).toBe("2026-06-21T14:45:00.000Z");
  });

  it("converts Toronto-local standard time to UTC", () => {
    const date = parseTorontoLocalDateTime("2026-01-15", 10, 45);

    expect(date.toISOString()).toBe("2026-01-15T15:45:00.000Z");
  });
});

describe("normalizeTorontoDropInRunCandidate", () => {
  it("normalizes a representative basketball row", () => {
    const candidate = normalizeTorontoDropInRunCandidate(firstBasketballRow);

    expect(candidate).toMatchObject({
      title: "Basketball",
      description: "Sports - Drop-In",
      sourceType: RunSourceType.CITY,
      sourceUrl:
        "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
      sourceExternalId: "toronto-drop-in:127611:329:2026-06-21:10:45",
      sourceSeriesId: "toronto-drop-in:127611:329",
      price: null,
      skillLevel: SkillLevel.OPEN,
      ageGroup: AgeGroup.ADULT,
      maxPlayers: null,
      sourceAgeLabel: "19+",
      sourceMinAge: 19,
      sourceMaxAge: null,
      sourceLocationId: "329",
      rawSource: firstBasketballRow,
    });
    expect(candidate.startTime.toISOString()).toBe("2026-06-21T14:45:00.000Z");
    expect(candidate.endTime.toISOString()).toBe("2026-06-21T16:30:00.000Z");
    expect(candidate.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps family basketball to all ages", () => {
    const familyRow = parseFixtureRow(
      fixture.basketballRecords.find((record) => {
        return parseFixtureRow(record)["Course Title"] === "Basketball with Family";
      }),
    );

    expect(normalizeTorontoDropInRunCandidate(familyRow).ageGroup).toBe(
      AgeGroup.ALL_AGES,
    );
  });

  it("maps youth, adult, and senior source age ranges", () => {
    const youthRow = parseFixtureRow(
      fixture.basketballRecords.find((record) => {
        return parseFixtureRow(record)["Age Max"] === "18";
      }),
    );
    const seniorRow = parseFixtureRow(
      fixture.basketballRecords.find((record) => {
        return parseFixtureRow(record)["Age Min"] === "60";
      }),
    );

    expect(normalizeTorontoDropInRunCandidate(youthRow).ageGroup).toBe(
      AgeGroup.YOUTH,
    );
    expect(normalizeTorontoDropInRunCandidate(firstBasketballRow).ageGroup).toBe(
      AgeGroup.ADULT,
    );
    expect(normalizeTorontoDropInRunCandidate(seniorRow).ageGroup).toBe(
      AgeGroup.SENIOR,
    );
  });

  it("creates stable fingerprints from meaningful normalized content", () => {
    const original = normalizeTorontoDropInRunCandidate(firstBasketballRow);
    const repeated = normalizeTorontoDropInRunCandidate(firstBasketballRow);
    const changedSection = normalizeTorontoDropInRunCandidate({
      ...firstBasketballRow,
      Section: "Reserve a Spot - Sports",
    });
    const changedDatastoreId = normalizeTorontoDropInRunCandidate({
      ...firstBasketballRow,
      _id: 999999,
    });

    expect(repeated.sourceFingerprint).toBe(original.sourceFingerprint);
    expect(changedSection.sourceFingerprint).not.toBe(original.sourceFingerprint);
    expect(changedDatastoreId.sourceFingerprint).toBe(original.sourceFingerprint);
  });
});

describe("normalizeTorontoDropInRunCandidates", () => {
  it("returns candidates and skipped rows without throwing", () => {
    const result = normalizeTorontoDropInRunCandidates([
      fixture.sampleRecords[0],
      firstBasketballRawRecord,
      {
        ...firstBasketballRawRecord,
        "Course Title": "",
      },
      {
        ...firstBasketballRawRecord,
        "Last Date": "2026-06-22",
      },
      {
        ...firstBasketballRawRecord,
        "End Hour": 9,
      },
      {
        ...firstBasketballRawRecord,
        "Age Min": "19",
        "Age Max": "12",
      },
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceExternalId).toBe(
      "toronto-drop-in:127611:329:2026-06-21:10:45",
    );
    expect(result.skipped.map((row) => row.reason)).toEqual([
      "not_basketball",
      "invalid_source_row",
      "multi_date_range",
      "invalid_time_range",
      "invalid_age_range",
    ]);
  });
});
