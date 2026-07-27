"use client";

import { useActionState } from "react";
import {
  initialAdminActionState,
  type AdminActionState,
} from "@/lib/admin/imported-runs/action-validation";
import type { AdminVenueOption } from "@/server/admin/imported-runs/queries";
import { linkExternalVenueRefAction } from "../actions";

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
          className="text-sm font-medium text-zinc-100"
        >
          Link existing Venue
        </label>
        <select
          id={`venueId-${externalVenueRefId}`}
          name="venueId"
          required
          className="w-full min-w-0 max-w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
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
          <p className="text-sm text-rose-200">{fieldError(state, "venueId")}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || venues.length === 0}
        className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
      >
        {pending ? "Linking..." : "Link Venue"}
      </button>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "text-sm text-emerald-200"
              : "text-sm text-rose-200"
          }
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
