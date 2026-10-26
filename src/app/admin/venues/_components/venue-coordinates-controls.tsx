"use client";

import { useActionState } from "react";
import { raisedButtonClass } from "@/app/_components/raised-button";
import {
  initialVenueCoordinatesActionState,
  type VenueCoordinatesActionState,
} from "@/lib/validations/admin";
import {
  clearVenueCoordinatesAction,
  geocodeVenueAction,
  setVenueCoordinatesAction,
} from "../actions";

/**
 * The coordinate controls on each venue card.
 *
 * This exists so the coordinate gap is visible to the operator. A venue with
 * no coordinates is not broken -- it works everywhere except the map -- which
 * is exactly why it needs surfacing: without a badge here, the only symptom
 * is a pin that silently never appears, and nothing in the product says why.
 *
 * Three separate forms rather than one with a mode flag: each posts to its own
 * action with its own validation and its own message, and separate
 * useActionState hooks keep one form's error from appearing under another.
 */
const INPUT_CLASS =
  "min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court";

type VenueCoordinatesControlsProps = {
  venue: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    geocodedAt: Date | null;
    geocodeSource: string | null;
  };
};

function ActionMessage({ state }: { state: VenueCoordinatesActionState }) {
  if (state.status === "idle" || state.message === "") {
    return null;
  }

  return (
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
  );
}

export function VenueCoordinatesControls({
  venue,
}: VenueCoordinatesControlsProps) {
  const [geocodeState, geocodeFormAction, geocodePending] = useActionState(
    geocodeVenueAction,
    initialVenueCoordinatesActionState,
  );
  const [manualState, manualFormAction, manualPending] = useActionState(
    setVenueCoordinatesAction,
    initialVenueCoordinatesActionState,
  );
  const [clearState, clearFormAction, clearPending] = useActionState(
    clearVenueCoordinatesAction,
    initialVenueCoordinatesActionState,
  );

  const hasCoordinates = venue.latitude !== null && venue.longitude !== null;

  return (
    <div className="mt-5 space-y-4 border-t-2 border-line pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {hasCoordinates ? (
          <>
            <span className="rounded-[8px] border-2 border-foreground bg-success px-2 py-1 text-xs font-bold uppercase tracking-[0.12em]">
              On map
            </span>
            <span className="font-mono text-sm text-foreground/75">
              {venue.latitude!.toFixed(5)}, {venue.longitude!.toFixed(5)}
            </span>
            {venue.geocodeSource ? (
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60">
                {venue.geocodeSource}
                {venue.geocodedAt
                  ? ` · ${venue.geocodedAt.toISOString().slice(0, 10)}`
                  : ""}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="rounded-[8px] border-2 border-foreground bg-danger px-2 py-1 text-xs font-bold uppercase tracking-[0.12em]">
              No coordinates
            </span>
            <span className="text-sm text-foreground/70">
              Not shown on the map.
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <form action={geocodeFormAction}>
          <input type="hidden" name="venueId" value={venue.id} />
          <button
            type="submit"
            disabled={geocodePending}
            className={raisedButtonClass({ variant: "outline" })}
          >
            {geocodePending ? "Geocoding…" : "Geocode"}
          </button>
        </form>

        {hasCoordinates ? (
          <form action={clearFormAction}>
            <input type="hidden" name="venueId" value={venue.id} />
            <button
              type="submit"
              disabled={clearPending}
              className={raisedButtonClass({ variant: "outline" })}
            >
              {clearPending ? "Clearing…" : "Clear"}
            </button>
          </form>
        ) : null}

        <form
          action={manualFormAction}
          className="flex flex-wrap items-start gap-2"
        >
          <input type="hidden" name="venueId" value={venue.id} />
          <label
            className="sr-only"
            htmlFor={`latitude-${venue.id}`}
          >
            Latitude
          </label>
          <input
            id={`latitude-${venue.id}`}
            name="latitude"
            required
            inputMode="decimal"
            placeholder="Latitude"
            defaultValue={venue.latitude ?? ""}
            className={`${INPUT_CLASS} w-[140px]`}
          />
          <label
            className="sr-only"
            htmlFor={`longitude-${venue.id}`}
          >
            Longitude
          </label>
          <input
            id={`longitude-${venue.id}`}
            name="longitude"
            required
            inputMode="decimal"
            placeholder="Longitude"
            defaultValue={venue.longitude ?? ""}
            className={`${INPUT_CLASS} w-[140px]`}
          />
          <button
            type="submit"
            disabled={manualPending}
            className={raisedButtonClass({ variant: "solid" })}
          >
            {manualPending ? "Saving…" : "Save manually"}
          </button>
        </form>
      </div>

      <ActionMessage state={geocodeState} />
      <ActionMessage state={manualState} />
      <ActionMessage state={clearState} />
    </div>
  );
}
