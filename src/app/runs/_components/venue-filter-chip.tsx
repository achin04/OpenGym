import Link from "next/link";

/**
 * Shows that the listing is filtered to one venue, and lets the visitor undo
 * it.
 *
 * This is not decoration. The filter arrives from a map pin as a `venueId` in
 * the URL, which is invisible to anyone who did not notice the link they
 * followed; without the chip the page just shows fewer runs than the city has,
 * for no stated reason and with no way back short of editing the address bar.
 *
 * A link rather than a button so it works without JavaScript and can be opened
 * in a new tab like any other navigation.
 */
type VenueFilterChipProps = {
  venueName: string;
  params: Record<string, string>;
};

function hrefWithoutVenue(params: Record<string, string>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key !== "venueId" && value !== "") {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();

  return query === "" ? "/runs" : `/runs?${query}`;
}

export function VenueFilterChip({ venueName, params }: VenueFilterChipProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground/60">
        Filtered to
      </span>

      <span className="inline-flex items-center gap-2 rounded-[12px] border-2 border-foreground bg-court-200 px-3 py-2 text-sm font-semibold text-foreground shadow-[0_3px_0_0_var(--foreground)]">
        {venueName}

        <Link
          href={hrefWithoutVenue(params)}
          aria-label={`Clear the ${venueName} filter`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground leading-none transition hover:bg-foreground hover:text-background focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-3 w-3"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
        </Link>
      </span>
    </div>
  );
}
