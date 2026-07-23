"use client";

import { useActionState } from "react";
import {
  initialAdminActionState,
  type AdminActionState,
} from "@/lib/admin/imported-runs/action-validation";
import { createVenueFromExternalRefAction } from "../actions";

type CreateVenueFromSourceFormProps = {
  batchId: string;
  externalVenueRef: {
    id: string;
    sourceName: string;
    sourceAddressLine1: string | null;
    sourcePostalCode: string | null;
    sourceUrl: string | null;
  };
};

function fieldError(
  state: AdminActionState,
  field: string,
): string | undefined {
  return state.fieldErrors?.[field]?.[0];
}

export function CreateVenueFromSourceForm({
  batchId,
  externalVenueRef,
}: CreateVenueFromSourceFormProps) {
  const [state, formAction, pending] = useActionState(
    createVenueFromExternalRefAction,
    initialAdminActionState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input
        type="hidden"
        name="externalVenueRefId"
        value={externalVenueRef.id}
      />
      <input type="hidden" name="batchId" value={batchId} />

      <div className="grid gap-2">
        <label
          htmlFor={`name-${externalVenueRef.id}`}
          className="text-sm font-medium text-zinc-100"
        >
          New Venue name
        </label>
        <input
          id={`name-${externalVenueRef.id}`}
          name="name"
          required
          defaultValue={externalVenueRef.sourceName}
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
        />
        {fieldError(state, "name") ? (
          <p className="text-sm text-rose-200">{fieldError(state, "name")}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={`addressLine1-${externalVenueRef.id}`}
          className="text-sm font-medium text-zinc-100"
        >
          Address
        </label>
        <input
          id={`addressLine1-${externalVenueRef.id}`}
          name="addressLine1"
          required
          defaultValue={externalVenueRef.sourceAddressLine1 ?? ""}
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
        />
        {fieldError(state, "addressLine1") ? (
          <p className="text-sm text-rose-200">
            {fieldError(state, "addressLine1")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            htmlFor={`city-${externalVenueRef.id}`}
            className="text-sm font-medium text-zinc-100"
          >
            City
          </label>
          <input
            id={`city-${externalVenueRef.id}`}
            name="city"
            required
            defaultValue="Toronto"
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
          />
          {fieldError(state, "city") ? (
            <p className="text-sm text-rose-200">{fieldError(state, "city")}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor={`postalCode-${externalVenueRef.id}`}
            className="text-sm font-medium text-zinc-100"
          >
            Postal code
          </label>
          <input
            id={`postalCode-${externalVenueRef.id}`}
            name="postalCode"
            defaultValue={externalVenueRef.sourcePostalCode ?? ""}
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
          />
          {fieldError(state, "postalCode") ? (
            <p className="text-sm text-rose-200">
              {fieldError(state, "postalCode")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={`websiteUrl-${externalVenueRef.id}`}
          className="text-sm font-medium text-zinc-100"
        >
          Website URL
        </label>
        <input
          id={`websiteUrl-${externalVenueRef.id}`}
          name="websiteUrl"
          type="url"
          defaultValue={externalVenueRef.sourceUrl ?? ""}
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-emerald-300"
        />
        {fieldError(state, "websiteUrl") ? (
          <p className="text-sm text-rose-200">
            {fieldError(state, "websiteUrl")}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
      >
        {pending ? "Creating..." : "Create and Link Venue"}
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
