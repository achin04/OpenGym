import Link from "next/link";
import { RunSourceType } from "@/generated/prisma/enums";

/**
 * Who is running it, as three links rather than a select.
 *
 * It is the filter people reach for most, and the one with the fewest options,
 * so it earns being visible at all times instead of hidden behind a dropdown.
 * Links rather than a form control: each one is a real URL that can be shared,
 * opened in a new tab and read by a crawler, and the whole row works with no
 * JavaScript at all.
 *
 * Changing the filter drops back to the first batch on purpose -- carrying
 * `show` across would mean asking for 120 city programs because that is how
 * far someone had scrolled through everything.
 */
type RunSourceChipsProps = {
  activeSourceType: string;
  params: Record<string, string>;
};

const CHIPS: { value: string; label: string; icon: "all" | "city" | "people" }[] = [
  { value: "", label: "All runs", icon: "all" },
  { value: RunSourceType.CITY, label: "City programs", icon: "city" },
  { value: RunSourceType.USER, label: "Community runs", icon: "people" },
];

function hrefFor(params: Record<string, string>, sourceType: string): string {
  const search = new URLSearchParams(
    Object.entries(params).filter(
      ([key, value]) => value !== "" && key !== "sourceType" && key !== "show",
    ),
  );

  if (sourceType !== "") {
    search.set("sourceType", sourceType);
  }

  const query = search.toString();
  return query ? `/runs?${query}` : "/runs";
}

function ChipIcon({ kind }: { kind: "all" | "city" | "people" }) {
  if (kind === "all") {
    return null;
  }

  if (kind === "city") {
    return (
      // The one icon in the row with a colour of its own: it points at the
      // same municipal source the card's host strip marks in blue, so the chip
      // and the cards it filters to agree without a word being read.
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-[#1B4A78] group-aria-[current]:text-current"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 20V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14M14 20V10h4a1 1 0 0 1 1 1v9M3 20h18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0M16 7.2a3 3 0 0 1 0 5.6M17.5 19a5.6 5.6 0 0 0-2-4.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function RunSourceChips({
  activeSourceType,
  params,
}: RunSourceChipsProps) {
  return (
    <>
      {CHIPS.map((chip) => {
        const active = chip.value === activeSourceType;

        return (
          <Link
            key={chip.value || "all"}
            href={hrefFor(params, chip.value)}
            aria-current={active ? "true" : undefined}
            className={`group inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-foreground px-4 text-sm font-semibold transition ${
              active
                ? "bg-foreground text-background"
                : "bg-white text-foreground hover:bg-background"
            }`}
          >
            <ChipIcon kind={chip.icon} />
            {chip.label}
          </Link>
        );
      })}
    </>
  );
}
