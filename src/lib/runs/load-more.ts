/**
 * "Load more" in place of numbered pages.
 *
 * The listing is a feed ordered by start time, and runs leave it continuously
 * as they begin. Page numbers were a poor fit for that: page 7 means something
 * different an hour later, so a shared or bookmarked link quietly pointed at
 * different runs. A count of how many are shown is stable in a way a page
 * number is not -- the first N are still the first N.
 *
 * The count lives in the URL rather than in client state so the server renders
 * the whole list, the back button works, and nothing has to be refetched in
 * the browser.
 */
export const RUNS_BATCH_SIZE = 24;

/**
 * An upper bound on how much one page will render.
 *
 * Toronto alone returns well over a thousand upcoming runs. Without a ceiling
 * a crafted `?show=` -- or a determined clicker -- would put every one of them
 * in the DOM. At the cap the listing says so and asks for a narrower search
 * rather than pretending there is nothing more.
 */
export const RUNS_MAX_SHOWN = 480;

export type RunsLoadMore = {
  /** How many to fetch: what was asked for, clamped. */
  take: number;
  /** How many are actually on the page once the result set runs out. */
  shown: number;
  totalCount: number;
  remaining: number;
  /** False when everything is shown, or when the cap has been reached. */
  hasMore: boolean;
  /** True when more exist but the cap stops them being shown. */
  cappedOut: boolean;
  /** The `show` value the Load more link should request. */
  nextShow: number;
};

export function parseShowParam(
  value: string | string[] | undefined,
  batchSize: number = RUNS_BATCH_SIZE,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt((raw ?? "").trim(), 10);

  if (!Number.isFinite(parsed) || parsed < batchSize) {
    return batchSize;
  }

  // Rounded up to a whole batch so the URL cannot describe a half-step the UI
  // has no way to produce.
  const batches = Math.ceil(parsed / batchSize);

  return Math.min(batches * batchSize, RUNS_MAX_SHOWN);
}

export function buildRunsLoadMore(
  requestedShow: number,
  totalCount: number,
  batchSize: number = RUNS_BATCH_SIZE,
): RunsLoadMore {
  const take = Math.min(Math.max(batchSize, requestedShow), RUNS_MAX_SHOWN);
  const shown = Math.min(take, totalCount);
  const remaining = Math.max(0, totalCount - shown);
  const cappedOut = remaining > 0 && take >= RUNS_MAX_SHOWN;

  return {
    take,
    shown,
    totalCount,
    remaining,
    hasMore: remaining > 0 && !cappedOut,
    cappedOut,
    nextShow: Math.min(take + batchSize, RUNS_MAX_SHOWN),
  };
}

/**
 * The first batch is left out of the query string, so /runs and
 * /runs?show=24 are one address rather than two names for the same page.
 */
export function runsHrefWithShow(
  params: Record<string, string>,
  show: number,
  batchSize: number = RUNS_BATCH_SIZE,
): string {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== ""),
  );

  if (show <= batchSize) {
    search.delete("show");
  } else {
    search.set("show", String(show));
  }

  const query = search.toString();
  return query ? `/runs?${query}` : "/runs";
}
