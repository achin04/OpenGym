import { describe, expect, it, vi } from "vitest";
import {
  AgeGroup,
  RunSourceType,
  SkillLevel,
} from "@/generated/prisma/enums";
import {
  createTorontoSnapshotHash,
  diffTorontoRunCandidate,
  evaluateTorontoSourceHealth,
  findDuplicateTorontoSourceOccurrences,
} from "./dry-run";
import type { NormalizedRunCandidate, TorontoDropInRow } from "./normalization";

vi.mock("server-only", () => ({}));

const rawSource = {
  _id: 122,
  "Location ID": 329,
  Course_ID: 127611,
  "Course Title": "Basketball",
  Section: "Sports - Drop-In",
  "Age Min": "19",
  "Age Max": "None",
  "Date Range": "Jun 21, 2026",
  "Start Hour": 10,
  "Start Minute": 45,
  "End Hour": 12,
  "End Min": 30,
  "First Date": "2026-06-21",
  "Last Date": "2026-06-21",
  DayOftheWeek: "Sunday",
} satisfies TorontoDropInRow;

function candidate(
  overrides: Partial<NormalizedRunCandidate> = {},
): NormalizedRunCandidate {
  return {
    title: "Basketball",
    description: "Sports - Drop-In",
    sourceType: RunSourceType.CITY,
    sourceUrl:
      "https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/parks-and-recreation-facilities/location/?id=329",
    sourceExternalId: "toronto-drop-in:127611:329:2026-06-21:10:45",
    sourceSeriesId: "toronto-drop-in:127611:329",
    sourceFingerprint: "fingerprint-a",
    startTime: new Date("2026-06-21T14:45:00.000Z"),
    endTime: new Date("2026-06-21T16:30:00.000Z"),
    price: null,
    skillLevel: SkillLevel.OPEN,
    ageGroup: AgeGroup.ADULT,
    maxPlayers: null,
    sourceAgeLabel: "19+",
    sourceMinAge: 19,
    sourceMaxAge: null,
    sourceLocationId: "329",
    rawSource,
    ...overrides,
  };
}

describe("createTorontoSnapshotHash", () => {
  it("creates stable hashes for equivalent object content", () => {
    const left = createTorontoSnapshotHash({
      resource: {
        name: "Drop-in",
        id: "resource_1",
      },
      records: [
        {
          Course_ID: 127611,
          "Location ID": 329,
        },
      ],
    });
    const right = createTorontoSnapshotHash({
      records: [
        {
          "Location ID": 329,
          Course_ID: 127611,
        },
      ],
      resource: {
        id: "resource_1",
        name: "Drop-in",
      },
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when source content changes", () => {
    expect(createTorontoSnapshotHash({ total: 1 })).not.toBe(
      createTorontoSnapshotHash({ total: 2 }),
    );
  });
});

describe("evaluateTorontoSourceHealth", () => {
  it("marks matching non-empty source pages as complete", () => {
    const health = evaluateTorontoSourceHealth({
      dropInPage: { records: [{ _id: 1 }], total: 1 },
      locationsPage: { records: [{ _id: 2 }], total: 1 },
      facilitiesPage: { records: [], total: 0 },
    });

    expect(health).toEqual({
      isCompleteSnapshot: true,
      issues: [],
    });
  });

  it("reports empty and mismatched source pages", () => {
    const health = evaluateTorontoSourceHealth({
      dropInPage: { records: [], total: 4 },
      locationsPage: { records: [{ _id: 1 }], total: 2 },
      facilitiesPage: { records: [{ _id: 3 }], total: 4 },
    });

    expect(health.isCompleteSnapshot).toBe(false);
    expect(health.issues.map((issue) => issue.code)).toEqual([
      "DROP_IN_EMPTY",
      "DROP_IN_TOTAL_MISMATCH",
      "LOCATIONS_TOTAL_MISMATCH",
      "FACILITIES_TOTAL_MISMATCH",
    ]);
  });
});

describe("findDuplicateTorontoSourceOccurrences", () => {
  it("returns duplicate occurrence ids and whether fingerprints conflict", () => {
    const duplicates = findDuplicateTorontoSourceOccurrences([
      candidate({ sourceExternalId: "same", sourceFingerprint: "a" }),
      candidate({ sourceExternalId: "same", sourceFingerprint: "b" }),
      candidate({ sourceExternalId: "unique", sourceFingerprint: "c" }),
    ]);

    expect(duplicates).toEqual([
      {
        sourceOccurrenceId: "same",
        candidateCount: 2,
        sourceKeys: ["same", "same"],
        fingerprints: ["a", "b"],
        isConflicting: true,
      },
    ]);
  });

  it("does not report unique occurrence ids", () => {
    expect(
      findDuplicateTorontoSourceOccurrences([
        candidate({ sourceExternalId: "one" }),
        candidate({ sourceExternalId: "two" }),
      ]),
    ).toEqual([]);
  });
});

describe("diffTorontoRunCandidate", () => {
  it("returns no field diffs when an existing run matches the candidate", () => {
    const runCandidate = candidate();

    expect(
      diffTorontoRunCandidate(
        runCandidate,
        {
          id: "run_1",
          title: runCandidate.title,
          description: runCandidate.description,
          sourceType: runCandidate.sourceType,
          startTime: runCandidate.startTime,
          endTime: runCandidate.endTime,
          price: null,
          skillLevel: runCandidate.skillLevel,
          ageGroup: runCandidate.ageGroup,
          maxPlayers: runCandidate.maxPlayers,
          verified: true,
          sourceUrl: runCandidate.sourceUrl,
          sourceExternalId: runCandidate.sourceExternalId,
          sourceSeriesId: runCandidate.sourceSeriesId,
          sourceFingerprint: runCandidate.sourceFingerprint,
          sourceAgeLabel: runCandidate.sourceAgeLabel,
          sourceMinAge: runCandidate.sourceMinAge,
          sourceMaxAge: runCandidate.sourceMaxAge,
          venueId: "venue_1",
        },
        "venue_1",
      ),
    ).toEqual([]);
  });

  it("returns field-level diffs for changed run fields", () => {
    const runCandidate = candidate();
    const diffs = diffTorontoRunCandidate(
      runCandidate,
      {
        id: "run_1",
        title: "Old title",
        description: runCandidate.description,
        sourceType: runCandidate.sourceType,
        startTime: new Date("2026-06-21T13:45:00.000Z"),
        endTime: runCandidate.endTime,
        price: null,
        skillLevel: runCandidate.skillLevel,
        ageGroup: runCandidate.ageGroup,
        maxPlayers: runCandidate.maxPlayers,
        verified: true,
        sourceUrl: runCandidate.sourceUrl,
        sourceExternalId: runCandidate.sourceExternalId,
        sourceSeriesId: runCandidate.sourceSeriesId,
        sourceFingerprint: "old-fingerprint",
        sourceAgeLabel: runCandidate.sourceAgeLabel,
        sourceMinAge: runCandidate.sourceMinAge,
        sourceMaxAge: runCandidate.sourceMaxAge,
        venueId: "old_venue",
      },
      "venue_1",
    );

    expect(diffs).toEqual([
      {
        field: "title",
        current: "Old title",
        proposed: "Basketball",
      },
      {
        field: "startTime",
        current: "2026-06-21T13:45:00.000Z",
        proposed: "2026-06-21T14:45:00.000Z",
      },
      {
        field: "sourceFingerprint",
        current: "old-fingerprint",
        proposed: "fingerprint-a",
      },
      {
        field: "venueId",
        current: "old_venue",
        proposed: "venue_1",
      },
    ]);
  });
});
