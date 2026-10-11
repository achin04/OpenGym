import { describe, expect, it, vi } from "vitest";
import type { CkanPackage } from "./ckan";
import {
  compareTorontoSourceState,
  observeTorontoSourceState,
  type ObservedTorontoSourceState,
  type PreviousTorontoSourceState,
} from "./refresh";

vi.mock("server-only", () => ({}));

function ckanPackage(
  resources: {
    id: string;
    name: string;
    datastore_active?: boolean;
    last_modified?: string | null;
    metadata_modified?: string | null;
  }[],
  metadataModified: string | null = "2026-09-17T10:00:00.000Z",
): CkanPackage {
  return {
    id: "1a5be46a-4039-48cd-a2d2-8e702abf9516",
    name: "registered-programs-and-drop-in-courses-offering",
    title: "Registered Programs and Drop-In Courses Offering",
    metadata_modified: metadataModified,
    resources: resources.map((resource) => ({
      datastore_active: true,
      ...resource,
    })),
  };
}

function fullPackage(modified: string | null = "2026-09-17T09:00:00.000Z") {
  return ckanPackage([
    { id: "drop-in-1", name: "Drop-in", last_modified: modified },
    { id: "locations-1", name: "Locations", last_modified: modified },
    { id: "facilities-1", name: "Facilities", last_modified: modified },
  ]);
}

function observed(
  overrides: Partial<ObservedTorontoSourceState> = {},
): ObservedTorontoSourceState {
  const modifiedAt = new Date("2026-09-17T09:00:00.000Z");

  return {
    packageMetadataModifiedAt: new Date("2026-09-17T10:00:00.000Z"),
    dropIn: { resourceId: "drop-in-1", modifiedAt },
    locations: { resourceId: "locations-1", modifiedAt },
    facilities: { resourceId: "facilities-1", modifiedAt },
    ...overrides,
  };
}

function previous(
  overrides: Partial<PreviousTorontoSourceState> = {},
): PreviousTorontoSourceState {
  const modifiedAt = new Date("2026-09-17T09:00:00.000Z");

  return {
    batchId: "batch-1",
    dropIn: { resourceId: "drop-in-1", modifiedAt },
    locations: { resourceId: "locations-1", modifiedAt },
    facilities: { resourceId: "facilities-1", modifiedAt },
    ...overrides,
  };
}

describe("observeTorontoSourceState", () => {
  it("reads the id and modification timestamp of each resource it needs", () => {
    const state = observeTorontoSourceState(fullPackage());

    expect(state).toEqual({
      packageMetadataModifiedAt: new Date("2026-09-17T10:00:00.000Z"),
      dropIn: {
        resourceId: "drop-in-1",
        modifiedAt: new Date("2026-09-17T09:00:00.000Z"),
      },
      locations: {
        resourceId: "locations-1",
        modifiedAt: new Date("2026-09-17T09:00:00.000Z"),
      },
      facilities: {
        resourceId: "facilities-1",
        modifiedAt: new Date("2026-09-17T09:00:00.000Z"),
      },
    });
  });

  it("falls back to metadata_modified when last_modified is null", () => {
    const state = observeTorontoSourceState(
      ckanPackage([
        {
          id: "drop-in-1",
          name: "Drop-in",
          last_modified: null,
          metadata_modified: "2026-09-16T08:00:00.000Z",
        },
      ]),
    );

    expect(state.dropIn.modifiedAt).toEqual(
      new Date("2026-09-16T08:00:00.000Z"),
    );
  });

  it("reports nulls for a resource that is absent or not in the DataStore", () => {
    const state = observeTorontoSourceState(
      ckanPackage([
        {
          id: "drop-in-1",
          name: "Drop-in",
          datastore_active: false,
          last_modified: "2026-09-17T09:00:00.000Z",
        },
      ]),
    );

    expect(state.dropIn).toEqual({ resourceId: null, modifiedAt: null });
    expect(state.locations).toEqual({ resourceId: null, modifiedAt: null });
  });
});

describe("compareTorontoSourceState", () => {
  it("treats a missing baseline as a refresh", () => {
    const detection = compareTorontoSourceState(observed(), null);

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("NO_PREVIOUS_SNAPSHOT");
    expect(detection.comparedBatchId).toBeNull();
  });

  it("reports no refresh when every id and timestamp matches", () => {
    const detection = compareTorontoSourceState(observed(), previous());

    expect(detection.hasRefreshed).toBe(false);
    expect(detection.reason).toBe("UNCHANGED");
    expect(detection.comparedBatchId).toBe("batch-1");
  });

  it("detects a republished resource even when the timestamp is unchanged", () => {
    const detection = compareTorontoSourceState(
      observed({
        dropIn: {
          resourceId: "drop-in-2",
          modifiedAt: new Date("2026-09-17T09:00:00.000Z"),
        },
      }),
      previous(),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_REPLACED");
    expect(detection.details).toContain("Drop-in");
  });

  it("detects a newer timestamp", () => {
    const detection = compareTorontoSourceState(
      observed({
        locations: {
          resourceId: "locations-1",
          modifiedAt: new Date("2026-09-24T09:00:00.000Z"),
        },
      }),
      previous(),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
    expect(detection.details).toContain("Locations");
  });

  it("treats a rolled-back timestamp as a refresh too", () => {
    const detection = compareTorontoSourceState(
      observed({
        facilities: {
          resourceId: "facilities-1",
          modifiedAt: new Date("2026-09-10T09:00:00.000Z"),
        },
      }),
      previous(),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
    expect(detection.details).toContain("Facilities");
  });

  it("treats losing a timestamp we previously had as a refresh", () => {
    const detection = compareTorontoSourceState(
      observed({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
      }),
      previous(),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
  });

  it("treats gaining a timestamp we previously lacked as a refresh", () => {
    const detection = compareTorontoSourceState(
      observed(),
      previous({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
      }),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("RESOURCE_MODIFIED");
  });

  it("fails open when no resource reports a timestamp at all", () => {
    const detection = compareTorontoSourceState(
      observed({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
        locations: { resourceId: "locations-1", modifiedAt: null },
        facilities: { resourceId: "facilities-1", modifiedAt: null },
      }),
      previous({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
        locations: { resourceId: "locations-1", modifiedAt: null },
        facilities: { resourceId: "facilities-1", modifiedAt: null },
      }),
    );

    expect(detection.hasRefreshed).toBe(true);
    expect(detection.reason).toBe("TIMESTAMPS_UNAVAILABLE");
  });

  it("still reports unchanged when only some resources report timestamps", () => {
    const detection = compareTorontoSourceState(
      observed({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
      }),
      previous({
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
      }),
    );

    expect(detection.hasRefreshed).toBe(false);
    expect(detection.reason).toBe("UNCHANGED");
  });
});
