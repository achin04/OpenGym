import { describe, expect, it } from "vitest";
import {
  RUNS_BATCH_SIZE,
  RUNS_MAX_SHOWN,
  buildRunsLoadMore,
  parseShowParam,
  runsHrefWithShow,
} from "./load-more";

describe("parseShowParam", () => {
  it("defaults to one batch", () => {
    expect(parseShowParam(undefined)).toBe(RUNS_BATCH_SIZE);
    expect(parseShowParam("")).toBe(RUNS_BATCH_SIZE);
    expect(parseShowParam("nonsense")).toBe(RUNS_BATCH_SIZE);
  });

  it("never returns less than one batch", () => {
    expect(parseShowParam("1")).toBe(RUNS_BATCH_SIZE);
    expect(parseShowParam("-40")).toBe(RUNS_BATCH_SIZE);
  });

  it("rounds up to a whole batch", () => {
    expect(parseShowParam(String(RUNS_BATCH_SIZE + 1))).toBe(
      RUNS_BATCH_SIZE * 2,
    );
  });

  // The ceiling is the point: without it a crafted URL puts every upcoming run
  // in Toronto into the DOM at once.
  it("clamps a hostile value to the cap", () => {
    expect(parseShowParam("100000")).toBe(RUNS_MAX_SHOWN);
  });

  it("takes the first value when the param repeats", () => {
    expect(parseShowParam([String(RUNS_BATCH_SIZE * 2), "9999"])).toBe(
      RUNS_BATCH_SIZE * 2,
    );
  });
});

describe("buildRunsLoadMore", () => {
  it("reports more remaining when the result set is longer", () => {
    const result = buildRunsLoadMore(RUNS_BATCH_SIZE, 100);

    expect(result.take).toBe(RUNS_BATCH_SIZE);
    expect(result.shown).toBe(RUNS_BATCH_SIZE);
    expect(result.remaining).toBe(100 - RUNS_BATCH_SIZE);
    expect(result.hasMore).toBe(true);
    expect(result.cappedOut).toBe(false);
    expect(result.nextShow).toBe(RUNS_BATCH_SIZE * 2);
  });

  it("stops when everything is shown", () => {
    const result = buildRunsLoadMore(RUNS_BATCH_SIZE, 10);

    expect(result.shown).toBe(10);
    expect(result.remaining).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("reports an empty result set coherently", () => {
    const result = buildRunsLoadMore(RUNS_BATCH_SIZE, 0);

    expect(result.shown).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(result.cappedOut).toBe(false);
  });

  // hasMore and cappedOut are distinct on purpose: one asks for another batch,
  // the other asks for a narrower search, and the UI says different things.
  it("distinguishes the cap from the end of the list", () => {
    const result = buildRunsLoadMore(RUNS_MAX_SHOWN, 2000);

    expect(result.shown).toBe(RUNS_MAX_SHOWN);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.hasMore).toBe(false);
    expect(result.cappedOut).toBe(true);
  });

  it("never offers a next step past the cap", () => {
    expect(buildRunsLoadMore(RUNS_MAX_SHOWN, 2000).nextShow).toBe(
      RUNS_MAX_SHOWN,
    );
  });
});

describe("runsHrefWithShow", () => {
  it("omits the first batch from the query string", () => {
    expect(runsHrefWithShow({}, RUNS_BATCH_SIZE)).toBe("/runs");
    expect(runsHrefWithShow({ location: "Toronto" }, RUNS_BATCH_SIZE)).toBe(
      "/runs?location=Toronto",
    );
  });

  it("keeps the active filters alongside the count", () => {
    const href = runsHrefWithShow(
      { location: "Toronto", availability: "week", sourceType: "" },
      RUNS_BATCH_SIZE * 2,
    );

    expect(href).toContain("location=Toronto");
    expect(href).toContain("availability=week");
    expect(href).toContain(`show=${RUNS_BATCH_SIZE * 2}`);
    expect(href).not.toContain("sourceType");
  });
});
