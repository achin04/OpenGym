"use client";

import { useActionState } from "react";
import {
  initialAdminActionState,
  type AdminActionState,
} from "@/lib/admin/imported-runs/action-validation";
import type { AdminVenueOption } from "@/server/admin/imported-runs/queries";
import { linkExternalVenueRefAction } from "../actions";
import { raisedButtonClass } from "@/app/_components/raised-button";

type VenueLinkFormProps = {
  batchId: string;
  externalVenueRefId: string;
  venues: AdminVenueOption[];
};

function fieldError(
  state: AdminActionState,
  field: string,
): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function VenueLinkForm({
  batchId,
  externalVenueRefId,
  venues,
}: VenueLinkFormProps) {
  const [state, formAction, pending] = useActionState(
    linkExternalVenueRefAction,
    initialAdminActionState,
  );

  return (
    <form action={formAction} className="grid min-w-0 gap-3">
      <input
        type="hidden"
        name="externalVenueRefId"
        value={externalVenueRefId}
      />
      <input type="hidden" name="batchId" value={batchId} />

      <div className="grid min-w-0 gap-2">
        <label
          htmlFor={`venueId-${externalVenueRefId}`}
          className="text-sm font-semibold text-foreground"
        >
          Link existing Venue
        </label>
        <select
          id={`venueId-${externalVenueRefId}`}
          name="venueId"
          required
          className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
        >
          <option value="">Select a venue</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} · {venue.addressLine1}, {venue.city}
              {venue.postalCode ? ` ${venue.postalCode}` : ""}
            </option>
          ))}
        </select>
        {fieldError(state, "venueId") ? (
          <p className="text-sm font-semibold text-danger">{fieldError(state, "venueId")}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || venues.length === 0}
        className={`w-fit ${raisedButtonClass({ variant: "success" })} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {pending ? "Linking..." : "Link Venue"}
      </button>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "text-sm font-semibold text-success"
              : "text-sm font-semibold text-danger"
          }
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
