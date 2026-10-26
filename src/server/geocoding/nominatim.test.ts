import { beforeEach, describe, expect, it, vi } from "vitest";
import emptyFixture from "../../../tests/fixtures/nominatim/search-empty.json";
import johnInnesFixture from "../../../tests/fixtures/nominatim/search-john-innes.json";
import outOfProvinceFixture from "../../../tests/fixtures/nominatim/search-out-of-province.json";
import {
  geocodeVenueAddress,
  parseNominatimSearchResponse,
  resetGeocodeThrottleForTests,
} from "./nominatim";

vi.mock("server-only", () => ({}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const johnInnes = {
  addressLine1: "150 Sherbourne St",
  city: "Toronto",
  postalCode: "M5A 2R6",
};

beforeEach(() => {
  resetGeocodeThrottleForTests();
});

describe("parseNominatimSearchResponse", () => {
  it("returns coordinates for a match inside Ontario", () => {
    const outcome = parseNominatimSearchResponse(johnInnesFixture);

    expect(outcome).toEqual({
      status: "ok",
      latitude: 43.6555127,
      longitude: -79.3700321,
      displayName:
        "John Innes Community Recreation Centre, 150, Sherbourne Street, Moss Park, Old Toronto, Toronto, Ontario, M5A 2R6, Canada",
    });
  });

  it("reports no match for an empty result array", () => {
    const outcome = parseNominatimSearchResponse(emptyFixture);

    expect(outcome.status).toBe("no_match");
  });

  // The guard that matters most: Nominatim answering with a same-named street
  // on another continent. Treated as no_match rather than ok, because one bad
  // coordinate drags the map's fitBounds across the Atlantic.
  it("rejects a match outside Ontario", () => {
    const outcome = parseNominatimSearchResponse(outOfProvinceFixture);

    expect(outcome.status).toBe("no_match");
    expect(outcome.status === "no_match" ? outcome.reason : "").toContain(
      "outside Ontario",
    );
  });

  it("reports an error for non-numeric coordinates", () => {
    const outcome = parseNominatimSearchResponse([
      { lat: "not-a-number", lon: "-79.37" },
    ]);

    expect(outcome.status).toBe("error");
  });

  it("reports an error for a payload in an unexpected shape", () => {
    const outcome = parseNominatimSearchResponse({ error: "rate limited" });

    expect(outcome.status).toBe("error");
  });
});

describe("geocodeVenueAddress", () => {
  it("queries the shared venue geo string and returns coordinates", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(johnInnesFixture));

    const outcome = await geocodeVenueAddress(johnInnes, {
      fetcher,
      minRequestIntervalMs: 0,
    });

    expect(outcome.status).toBe("ok");

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit];

    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe(
      "150 Sherbourne St, Toronto, M5A 2R6, ON, Canada",
    );
    expect(url.searchParams.get("format")).toBe("jsonv2");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("countrycodes")).toBe("ca");

    // Required by Nominatim's usage policy, not a nicety.
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("OpenGym");
  });

  it("returns an error outcome rather than throwing on a non-2xx response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("slow down", { status: 429 }));

    const outcome = await geocodeVenueAddress(johnInnes, {
      fetcher,
      minRequestIntervalMs: 0,
    });

    expect(outcome.status).toBe("error");
    expect(outcome.status === "error" ? outcome.reason : "").toContain("429");
  });

  it("returns an error outcome rather than throwing when the request fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const outcome = await geocodeVenueAddress(johnInnes, {
      fetcher,
      minRequestIntervalMs: 0,
    });

    expect(outcome).toEqual({ status: "error", reason: "ECONNREFUSED" });
  });

  it("returns an error outcome when the request times out", async () => {
    const fetcher = vi.fn().mockImplementation((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(
            Object.assign(new Error("aborted"), { name: "AbortError" }),
          );
        });
      });
    });

    const outcome = await geocodeVenueAddress(johnInnes, {
      fetcher,
      minRequestIntervalMs: 0,
      requestTimeoutMs: 5,
    });

    expect(outcome.status).toBe("error");
    expect(outcome.status === "error" ? outcome.reason : "").toContain(
      "timed out",
    );
  });

  // Concurrent callers must not collapse onto the same slot: that is the whole
  // point of claiming the slot before awaiting rather than after.
  it("serialises concurrent requests at least one interval apart", async () => {
    const callTimes: number[] = [];
    const fetcher = vi.fn().mockImplementation(() => {
      callTimes.push(Date.now());
      return Promise.resolve(jsonResponse(johnInnesFixture));
    });

    await Promise.all([
      geocodeVenueAddress(johnInnes, { fetcher, minRequestIntervalMs: 40 }),
      geocodeVenueAddress(johnInnes, { fetcher, minRequestIntervalMs: 40 }),
    ]);

    expect(callTimes).toHaveLength(2);
    expect(callTimes[1]! - callTimes[0]!).toBeGreaterThanOrEqual(35);
  });
});
