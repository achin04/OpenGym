import { describe, expect, it } from "vitest";
import {
  RUNS_PAGE_SIZE,
  buildRunsPagination,
  pageLinks,
  parsePageParam,
  runsHrefForPage,
} from "./pagination";

describe("parsePageParam", () => {
  it("reads a page number", () => {
    expect(parsePageParam("4")).toBe(4);
  });

  it("takes the first value when the param repeats", () => {
    expect(parsePageParam(["3", "9"])).toBe(3);
  });

  it.each([undefined, "", "   ", "abc", "0", "-2", "1.5e9999"])(
    "falls back to page 1 for %p",
    (value) => {
      expect(parsePageParam(value)).toBe(1);
    },
  );

  it("ignores trailing junk the same way the URL bar might send it", () => {
    expect(parsePageParam("2abc")).toBe(2);
  });
});

describe("buildRunsPagination", () => {
  it("describes the first page of a multi-page result", () => {
    const pagination = buildRunsPagination(1, 1_872);

    expect(pagination).toEqual({
      page: 1,
      pageCount: 39,
      totalCount: 1_872,
      skip: 0,
      take: RUNS_PAGE_SIZE,
    });
  });

  it("offsets later pages by whole pages", () => {
    expect(buildRunsPagination(3, 1_872).skip).toBe(RUNS_PAGE_SIZE * 2);
  });

  it("clamps a page past the end to the last real page", () => {
    // Runs leave the listing as they start, so a link to a late page can go
    // stale just by being opened later in the day.
    const pagination = buildRunsPagination(99, 100);

    expect(pagination.page).toBe(3);
    expect(pagination.skip).toBe(RUNS_PAGE_SIZE * 2);
  });

  it("still has one page when nothing matched", () => {
    expect(buildRunsPagination(1, 0)).toMatchObject({
      page: 1,
      pageCount: 1,
      skip: 0,
    });
  });

  it("does not add a page for an exactly full one", () => {
    expect(buildRunsPagination(1, RUNS_PAGE_SIZE).pageCount).toBe(1);
    expect(buildRunsPagination(1, RUNS_PAGE_SIZE + 1).pageCount).toBe(2);
  });
});

describe("pageLinks", () => {
  it("lists every page when they all fit", () => {
    expect(pageLinks(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first and last page reachable from the middle", () => {
    const links = pageLinks(20, 39);

    expect(links[0]).toBe(1);
    expect(links.at(-1)).toBe(39);
    expect(links).toContain(20);
    expect(links.filter((link) => link === "gap")).toHaveLength(2);
  });

  it("opens with a run of pages and one gap", () => {
    expect(pageLinks(1, 39)).toEqual([1, 2, 3, 4, "gap", 39]);
  });

  it("ends with a run of pages and one gap", () => {
    expect(pageLinks(39, 39)).toEqual([1, "gap", 36, 37, 38, 39]);
  });

  it("never shows more entries than it was allowed", () => {
    for (let page = 1; page <= 39; page += 1) {
      expect(pageLinks(page, 39).length).toBeLessThanOrEqual(7);
    }
  });

  it("always includes the current page", () => {
    for (let page = 1; page <= 39; page += 1) {
      expect(pageLinks(page, 39)).toContain(page);
    }
  });
});

describe("runsHrefForPage", () => {
  it("leaves page 1 out so it shares the bare listing URL", () => {
    expect(runsHrefForPage({ availability: "upcoming" }, 1)).toBe(
      "/runs?availability=upcoming",
    );
  });

  it("drops empty filters", () => {
    expect(runsHrefForPage({ location: "", availability: "any" }, 2)).toBe(
      "/runs?availability=any&page=2",
    );
  });

  it("keeps the active filters on every page link", () => {
    const href = runsHrefForPage(
      { location: "Scarborough", availability: "week", skillLevel: "OPEN" },
      3,
    );

    expect(href).toContain("location=Scarborough");
    expect(href).toContain("availability=week");
    expect(href).toContain("skillLevel=OPEN");
    expect(href).toContain("page=3");
  });

  it("escapes values that need it", () => {
    expect(runsHrefForPage({ location: "North York & East" }, 2)).toContain(
      "location=North+York+%26+East",
    );
  });

  it("returns the bare listing when nothing is set", () => {
    expect(runsHrefForPage({}, 1)).toBe("/runs");
  });
});
