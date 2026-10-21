"use client";

import { useRouter } from "next/navigation";
import { raisedButtonClass } from "@/app/_components/raised-button";
import { RESET_RUNS_FILTERS_EVENT } from "./source-filter-with-advanced";

function setFormControlValue(
  form: HTMLFormElement,
  name: string,
  value: string,
) {
  const control = form.elements.namedItem(name);

  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
  ) {
    control.value = value;
  }
}

export function ResetRunsFiltersButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={(event) => {
        const form = event.currentTarget.closest("form");

        if (form) {
          setFormControlValue(form, "location", "");
          setFormControlValue(form, "availability", "upcoming");
        }

        window.dispatchEvent(new Event(RESET_RUNS_FILTERS_EVENT));
        router.replace("/runs");
      }}
      className={raisedButtonClass()}
    >
      Reset
    </button>
  );
}
