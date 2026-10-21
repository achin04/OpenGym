"use client";

import { useEffect, useState } from "react";

import { FIELD_LABEL, SELECT_FIELD } from "@/app/_components/field";

export const RESET_RUNS_FILTERS_EVENT = "opengym:reset-runs-filters";

type FilterOption = {
  value: string;
  label: string;
};

type SourceFilterWithAdvancedProps = {
  sourceType: string;
  skillLevel: string;
  ageGroup: string;
  sourceOptions: FilterOption[];
  skillOptions: FilterOption[];
  ageOptions: FilterOption[];
};

function SlidersIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7h3m4 0h9M4 17h9m4 0h3M9 5v4m6 6v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function SourceFilterWithAdvanced({
  sourceType,
  skillLevel,
  ageGroup,
  sourceOptions,
  skillOptions,
  ageOptions,
}: SourceFilterWithAdvancedProps) {
  const [open, setOpen] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState(sourceType);
  const [selectedSkillLevel, setSelectedSkillLevel] = useState(skillLevel);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(ageGroup);
  const currentAdvancedFilterCount = [
    selectedSkillLevel,
    selectedAgeGroup,
  ].filter(Boolean).length;

  useEffect(() => {
    function resetFilters() {
      setOpen(false);
      setSelectedSourceType("");
      setSelectedSkillLevel("");
      setSelectedAgeGroup("");
    }

    window.addEventListener(RESET_RUNS_FILTERS_EVENT, resetFilters);

    return () => {
      window.removeEventListener(RESET_RUNS_FILTERS_EVENT, resetFilters);
    };
  }, []);

  return (
    <div className="relative grid gap-1">
      <input type="hidden" name="skillLevel" value={selectedSkillLevel} />
      <input type="hidden" name="ageGroup" value={selectedAgeGroup} />

      <label
        htmlFor="sourceType"
        className={FIELD_LABEL}
      >
        Source
      </label>

      <div className="flex gap-2">
        <select
          id="sourceType"
          name="sourceType"
          value={selectedSourceType}
          onChange={(event) => setSelectedSourceType(event.target.value)}
          className={`${SELECT_FIELD} flex-1`}
        >
          {sourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-expanded={open}
          aria-label="Advanced filters"
          onClick={() => setOpen((current) => !current)}
          className="relative flex min-h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border-2 border-foreground bg-white text-foreground shadow-[0_4px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[2px] hover:shadow-[0_2px_0_0_var(--foreground)] active:translate-y-[4px] active:shadow-none motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <SlidersIcon />
          {currentAdvancedFilterCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-foreground bg-court px-1 text-[11px] font-bold text-foreground">
              {currentAdvancedFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Advanced filters"
          className="absolute right-0 top-full z-20 mt-3 w-[calc(100vw-2.5rem)] max-w-[24rem] rounded-[16px] border-2 border-foreground bg-surface p-4 shadow-[0_6px_0_0_var(--foreground)]"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label
                htmlFor="skillLevel"
                className={FIELD_LABEL}
              >
                Skill
              </label>
              <select
                id="skillLevel"
                value={selectedSkillLevel}
                onChange={(event) => setSelectedSkillLevel(event.target.value)}
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
              <label
                htmlFor="ageGroup"
                className={FIELD_LABEL}
              >
                Age
              </label>
              <select
                id="ageGroup"
                value={selectedAgeGroup}
                onChange={(event) => setSelectedAgeGroup(event.target.value)}
                className={SELECT_FIELD}
              >
                {ageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
