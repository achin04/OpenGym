import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TorontoAutoImportResult } from "@/server/importers/toronto/auto-import";
import { GET } from "./route";

const { runTorontoAutoImport } = vi.hoisted(() => ({
  runTorontoAutoImport: vi.fn(),
}));

// Mocked for the same reason the importer is: this file tests the route's
// auth, shape and error handling, and a real call would want a database and
// the network.
vi.mock("@/server/geocoding/venue-coordinates", () => ({
  geocodeMissingVenues: vi.fn(),
}));

vi.mock("@/server/importers/toronto/auto-import", () => ({
  runTorontoAutoImport,
}));

const SECRET = "test-cron-secret";

function request(authorization?: string) {
  return new Request("https://findopengym.com/api/cron/import-toronto", {
    headers: authorization ? { authorization } : {},
  });
}

function skippedResult(): TorontoAutoImportResult {
  return {
    status: "SKIPPED_NO_REFRESH",
    scheduleSourceId: "schedule-source-1",
    refresh: {
      hasRefreshed: false,
      reason: "UNCHANGED",
      details: "Resource ids and timestamps match batch batch-1.",
      comparedBatchId: "batch-1",
      observed: {
        packageMetadataModifiedAt: null,
        dropIn: { resourceId: "drop-in-1", modifiedAt: null },
        locations: { resourceId: "locations-1", modifiedAt: null },
        facilities: { resourceId: "facilities-1", modifiedAt: null },
      },
    },
    dryRun: null,
    gate: null,
    apply: null,
  };
}

describe("GET /api/cron/import-toronto", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    runTorontoAutoImport.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to run when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(503);
    expect(runTorontoAutoImport).not.toHaveBeenCalled();
  });

  it("rejects a request with no authorization header", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(runTorontoAutoImport).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    const response = await GET(request("Bearer not-the-secret"));

    expect(response.status).toBe(401);
    expect(runTorontoAutoImport).not.toHaveBeenCalled();
  });

  it("rejects a secret that is only a prefix of the real one", async () => {
    const response = await GET(request(`Bearer ${SECRET.slice(0, 5)}`));

    expect(response.status).toBe(401);
    expect(runTorontoAutoImport).not.toHaveBeenCalled();
  });

  it("runs the import and summarizes the outcome for a valid secret", async () => {
    runTorontoAutoImport.mockResolvedValue(skippedResult());

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(runTorontoAutoImport).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      status: "SKIPPED_NO_REFRESH",
      refresh: {
        hasRefreshed: false,
        reason: "UNCHANGED",
      },
      dryRun: null,
      apply: null,
    });
  });

  it("reports a failed import as a 500 with its message", async () => {
    runTorontoAutoImport.mockRejectedValue(
      new Error("DataStore Drop-in returned an empty page at offset 5000"),
    );

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "DataStore Drop-in returned an empty page at offset 5000",
    });
  });
});
