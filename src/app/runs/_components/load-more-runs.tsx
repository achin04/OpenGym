import Link from "next/link";
import { raisedButtonClass } from "@/app/_components/raised-button";
import type { RunsLoadMore } from "@/lib/runs/load-more";
import { runsHrefWithShow } from "@/lib/runs/load-more";

/**
 * Load more, as a link rather than a button.
 *
 * It asks the server for a longer list at a real URL, so the result is
 * shareable, the back button steps back through the lengths, and nothing has
 * to be fetched or stitched together in the browser.
 *
 * scroll={false} is what makes it feel like appending instead of navigating:
 * without it Next jumps to the top of the page and the newly loaded runs are
 * somewhere far below.
 */
export function LoadMoreRuns({
  loadMore,
  params,
}: {
  loadMore: RunsLoadMore;
  params: Record<string, string>;
}) {
  if (loadMore.cappedOut) {
    return (
      <p className="pt-2 text-center text-sm text-foreground/70">
        Showing the first {loadMore.shown} runs. Narrow the search to see the
        other {loadMore.remaining}.
      </p>
    );
  }

  if (!loadMore.hasMore) {
    return null;
  }

  const nextBatch = Math.min(
    loadMore.remaining,
    loadMore.nextShow - loadMore.shown,
  );

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <Link
        href={runsHrefWithShow(params, loadMore.nextShow)}
        scroll={false}
        className={raisedButtonClass()}
      >
        Load {nextBatch} more
      </Link>
      <p className="text-sm text-foreground/60">
        Showing {loadMore.shown} of {loadMore.totalCount}
      </p>
    </div>
  );
}
