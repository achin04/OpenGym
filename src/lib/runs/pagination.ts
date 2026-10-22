export const RUNS_PAGE_SIZE = 48;

export type RunsPagination = {
  // Clamped to a page that exists, so it may differ from what was requested.
  page: number;
  pageCount: number;
  totalCount: number;
  skip: number;
  take: number;
};

// A gap stands for pages hidden between two shown ones, rendered as an ellipsis.
export type PageLink = number | "gap";

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt((raw ?? "").trim(), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// The requested page is clamped rather than treated as not found. Runs leave
// this listing continuously as they start, so a bookmarked or shared link to a
// late page becomes invalid just by being opened later in the day; showing the
// last real page is friendlier than an empty one, and pageCount stays at least
// 1 so an empty result still has a coherent page to render.
export function buildRunsPagination(
  requestedPage: number,
  totalCount: number,
  pageSize: number = RUNS_PAGE_SIZE,
): RunsPagination {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);

  return {
    page,
    pageCount,
    totalCount,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

// Toronto's feed alone produces around forty pages, so every page cannot have a
// link. The first and last are always reachable, with a window around the
// current page and gaps standing in for the rest.
export function pageLinks(
  page: number,
  pageCount: number,
  maxLinks: number = 7,
): PageLink[] {
  if (pageCount <= maxLinks) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  // Reserve room for the first page, the last page, and two gaps.
  const windowSize = Math.max(1, maxLinks - 4);
  let start = Math.max(2, page - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;

  if (end >= pageCount) {
    end = pageCount - 1;
    start = Math.max(2, end - windowSize + 1);
  }

  const links: PageLink[] = [1];

  if (start > 2) {
    links.push("gap");
  }

  for (let current = start; current <= end; current += 1) {
    links.push(current);
  }

  if (end < pageCount - 1) {
    links.push("gap");
  }

  links.push(pageCount);

  return links;
}

// Page 1 is left out of the query string so the first page and the bare /runs
// URL are the same page rather than two addresses for one thing.
export function runsHrefForPage(
  params: Record<string, string>,
  page: number,
): string {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== ""),
  );

  if (page <= 1) {
    search.delete("page");
  } else {
    search.set("page", String(page));
  }

  const query = search.toString();
  return query ? `/runs?${query}` : "/runs";
}
