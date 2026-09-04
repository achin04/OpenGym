"use client";

import { useState } from "react";

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
  const [selectedSkillLevel, setSelectedSkillLevel] = useState(skillLevel);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(ageGroup);
  const currentAdvancedFilterCount = [
    selectedSkillLevel,
    selectedAgeGroup,
  ].filter(Boolean).length;

  return (
    <div className="relative grid gap-1">
      <input type="hidden" name="skillLevel" value={selectedSkillLevel} />
      <input type="hidden" name="ageGroup" value={selectedAgeGroup} />

      <label
        htmlFor="sourceType"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
      >
        Source
      </label>

      <div className="flex gap-2">
        <select
          id="sourceType"
          name="sourceType"
          defaultValue={sourceType}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
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
          className="relative flex min-h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/10 bg-background text-cream/70 transition hover:border-court/50 hover:text-court-200 focus:outline-none focus:ring-2 focus:ring-court/35"
        >
          <SlidersIcon />
          {currentAdvancedFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-court px-1 text-[11px] font-semibold text-background">
              {currentAdvancedFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Advanced filters"
          className="absolute right-0 top-full z-20 mt-2 w-[calc(100vw-2.5rem)] max-w-[24rem] rounded-lg border border-line bg-ink-950 p-4 shadow-2xl shadow-black/40"
        >
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label
                htmlFor="skillLevel"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
              >
                Skill
              </label>
              <select
                id="skillLevel"
                value={selectedSkillLevel}
                onChange={(event) => setSelectedSkillLevel(event.target.value)}
                className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
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
                className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
              >
                Age
              </label>
              <select
                id="ageGroup"
                value={selectedAgeGroup}
                onChange={(event) => setSelectedAgeGroup(event.target.value)}
                className="min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
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
