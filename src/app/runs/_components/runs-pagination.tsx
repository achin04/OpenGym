import Link from "next/link";
import { pageLinks, runsHrefForPage } from "@/lib/runs/pagination";

type RunsPaginationProps = {
  page: number;
  pageCount: number;
  // The current filter values, so every page link keeps the active search.
  params: Record<string, string>;
};

const linkClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border-2 border-foreground px-3 text-sm font-semibold transition hover:bg-foreground hover:text-background";

const currentClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border-2 border-foreground bg-foreground px-3 text-sm font-semibold text-background";

const disabledClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border-2 border-foreground/25 px-3 text-sm font-semibold text-foreground/35";

export function RunsPagination({ page, pageCount, params }: RunsPaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const links = pageLinks(page, pageCount);

  return (
    <nav
      aria-label="Run listing pages"
      className="flex flex-wrap items-center justify-center gap-2 pt-2"
    >
      {page > 1 ? (
        <Link
          href={runsHrefForPage(params, page - 1)}
          rel="prev"
          className={linkClass}
        >
          Previous
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          Previous
        </span>
      )}

      {links.map((link, index) =>
        link === "gap" ? (
          <span
            // Gaps have no page number of their own, and there are at most two.
            key={`gap-${index}`}
            className="px-1 text-sm text-foreground/50"
            aria-hidden="true"
          >
            …
          </span>
        ) : link === page ? (
          <span key={link} aria-current="page" className={currentClass}>
            {link}
          </span>
        ) : (
          <Link
            key={link}
            href={runsHrefForPage(params, link)}
            className={linkClass}
            aria-label={`Page ${link}`}
          >
            {link}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={runsHrefForPage(params, page + 1)}
          rel="next"
          className={linkClass}
        >
          Next
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          Next
        </span>
      )}
    </nav>
  );
}
