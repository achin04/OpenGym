"use client";

import { useEffect, useRef, useState } from "react";
import { FIELD_LABEL, SELECT_FIELD } from "@/app/_components/field";
import { raisedButtonClass } from "@/app/_components/raised-button";

/**
 * Level and age, behind a chip.
 *
 * These two are hidden rather than shown because almost every imported run
 * carries the same values, so they filter nothing most of the time and would
 * only add noise to the row that matters.
 *
 * The selects use the `form` attribute to belong to the search form further up
 * the page even though they sit outside it in the DOM. That is what lets this
 * popover live in the chip row while still submitting through the same plain
 * GET as the Where and When fields -- no client-side navigation, no duplicated
 * state, and it still works if the popover's JavaScript never loads.
 */
type FilterOption = { value: string; label: string };

type MoreFiltersProps = {
  formId: string;
  skillLevel: string;
  ageGroup: string;
  skillOptions: FilterOption[];
  ageOptions: FilterOption[];
};

function SlidersIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 7h3m4 0h9M4 17h9m4 0h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function MoreFilters({
  formId,
  skillLevel,
  ageGroup,
  skillOptions,
  ageOptions,
}: MoreFiltersProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeCount = [skillLevel, ageGroup].filter(Boolean).length;

  // A popover that cannot be dismissed is a trap; Escape and an outside click
  // are the two ways people expect to get out of one.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="More filters"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-dashed border-foreground/55 px-4 text-sm font-semibold text-foreground transition hover:border-foreground hover:bg-white"
      >
        <SlidersIcon />
        More filters
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-court px-1 text-[11px] font-bold text-foreground">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="More filters"
          className="absolute left-0 top-full z-20 mt-3 w-[calc(100vw-2.5rem)] max-w-[22rem] rounded-[16px] border-2 border-foreground bg-surface p-4 shadow-[0_6px_0_0_var(--foreground)]"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label htmlFor="skillLevel" className={FIELD_LABEL}>
                Level
              </label>
              <select
                id="skillLevel"
                name="skillLevel"
                form={formId}
                defaultValue={skillLevel}
                className={SELECT_FIELD}
              >
                {skillOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label htmlFor="ageGroup" className={FIELD_LABEL}>
                Age
              </label>
              <select
                id="ageGroup"
                name="ageGroup"
                form={formId}
                defaultValue={ageGroup}
                className={SELECT_FIELD}
              >
                {ageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              form={formId}
              className={`mt-1 ${raisedButtonClass({ variant: "solid" })}`}
            >
              Apply filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
