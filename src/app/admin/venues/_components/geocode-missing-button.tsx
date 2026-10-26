"use client";

import { useActionState } from "react";
import { raisedButtonClass } from "@/app/_components/raised-button";
import {
  initialVenueCoordinatesActionState,
} from "@/lib/validations/admin";
import { geocodeMissingVenuesAction } from "../actions";

/**
 * Backfills coordinates one batch at a time.
 *
 * The only route to a backfill on production, where the script cannot reach
 * the database. Shown only while something is actually missing, so it
 * disappears once the job is done rather than sitting there as a button that
 * does nothing.
 */
export function GeocodeMissingButton({ missingCount }: { missingCount: number }) {
  const [state, formAction, pending] = useActionState(
    geocodeMissingVenuesAction,
    initialVenueCoordinatesActionState,
  );

  if (missingCount === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={raisedButtonClass({ variant: "solid" })}
        >
          {pending ? "Geocoding\u2026" : "Geocode missing venues"}
        </button>
      </form>

      {state.status !== "idle" && state.message !== "" ? (
        <p
          role="status"
          className={
            state.status === "success"
              ? "text-sm font-semibold text-foreground/75"
              : "text-sm font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
