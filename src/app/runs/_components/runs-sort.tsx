"use client";

import { useRouter } from "next/navigation";
import { SELECT_FIELD } from "@/app/_components/field";
import { RUNS_SORT_OPTIONS, type RunsSort } from "@/lib/runs/sort";

/**
 * Sort order, as a select that navigates on change.
 *
 * The one control on this page that genuinely needs JavaScript. Everything
 * else -- the search fields, the source chips, Load more -- is a link or a
 * plain GET form, but a select with no adjacent button has to act on change,
 * and a change event is not something HTML can turn into a navigation on its
 * own. The cost is small and contained: without JavaScript the listing still
 * renders in its default order, which is the order most people want.
 *
 * Changing the sort returns to the first batch. Keeping `show` would hold a
 * long list open while reordering everything inside it, which loses the place
 * it was meant to preserve.
 */
export function RunsSortSelect({
  sort,
  params,
}: {
  sort: RunsSort;
  params: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="runs-sort"
        className="text-sm font-medium text-foreground/60"
      >
        Sort
      </label>
      <select
        id="runs-sort"
        defaultValue={sort}
        onChange={(event) => {
          const search = new URLSearchParams(
            Object.entries(params).filter(
              ([key, value]) => value !== "" && key !== "sort" && key !== "show",
            ),
          );

          if (event.target.value !== "soonest") {
            search.set("sort", event.target.value);
          }

          const query = search.toString();
          router.push(query ? `/runs?${query}` : "/runs");
        }}
        className={`${SELECT_FIELD} min-h-10 w-auto`}
      >
        {RUNS_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
