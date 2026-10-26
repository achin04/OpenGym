/**
 * Sort order for the runs listing.
 *
 * Lives in lib rather than beside the select because both sides of the client
 * boundary need it: the server component parses the param and orders the
 * query, the client component renders the control. A "use client" module
 * cannot be called from the server at all -- only rendered -- so parsing from
 * there fails at runtime rather than at build time.
 */
export const RUNS_SORT_OPTIONS = [
  { value: "soonest", label: "Soonest" },
  { value: "latest", label: "Latest" },
] as const;

export type RunsSort = (typeof RUNS_SORT_OPTIONS)[number]["value"];

export function parseRunsSort(value: string | string[] | undefined): RunsSort {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();

  return RUNS_SORT_OPTIONS.some((option) => option.value === raw)
    ? (raw as RunsSort)
    : "soonest";
}
