"use client";

import { useActionState } from "react";
import {
  initialAdminActionState,
  type AdminActionState,
} from "@/lib/admin/imported-runs/action-validation";
import { createVenueFromExternalRefAction } from "../actions";
import { raisedButtonClass } from "@/app/_components/raised-button";

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
          className="text-sm font-semibold text-foreground"
        >
          New Venue name
        </label>
        <input
          id={`name-${externalVenueRef.id}`}
          name="name"
          required
          defaultValue={externalVenueRef.sourceName}
          className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
        />
        {fieldError(state, "name") ? (
          <p className="text-sm font-semibold text-danger">{fieldError(state, "name")}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={`addressLine1-${externalVenueRef.id}`}
          className="text-sm font-semibold text-foreground"
        >
          Address
        </label>
        <input
          id={`addressLine1-${externalVenueRef.id}`}
          name="addressLine1"
          required
          defaultValue={externalVenueRef.sourceAddressLine1 ?? ""}
          className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
        />
        {fieldError(state, "addressLine1") ? (
          <p className="text-sm font-semibold text-danger">
            {fieldError(state, "addressLine1")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            htmlFor={`city-${externalVenueRef.id}`}
            className="text-sm font-semibold text-foreground"
          >
            City
          </label>
          <input
            id={`city-${externalVenueRef.id}`}
            name="city"
            required
            defaultValue="Toronto"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />
          {fieldError(state, "city") ? (
            <p className="text-sm font-semibold text-danger">{fieldError(state, "city")}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            htmlFor={`postalCode-${externalVenueRef.id}`}
            className="text-sm font-semibold text-foreground"
          >
            Postal code
          </label>
          <input
            id={`postalCode-${externalVenueRef.id}`}
            name="postalCode"
            defaultValue={externalVenueRef.sourcePostalCode ?? ""}
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />
          {fieldError(state, "postalCode") ? (
            <p className="text-sm font-semibold text-danger">
              {fieldError(state, "postalCode")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={`websiteUrl-${externalVenueRef.id}`}
          className="text-sm font-semibold text-foreground"
        >
          Website URL
        </label>
        <input
          id={`websiteUrl-${externalVenueRef.id}`}
          name="websiteUrl"
          type="url"
          defaultValue={externalVenueRef.sourceUrl ?? ""}
          className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
        />
        {fieldError(state, "websiteUrl") ? (
          <p className="text-sm font-semibold text-danger">
            {fieldError(state, "websiteUrl")}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`w-fit ${raisedButtonClass({ variant: "success" })} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {pending ? "Creating..." : "Create and Link Venue"}
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
