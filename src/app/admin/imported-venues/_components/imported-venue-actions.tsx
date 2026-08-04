"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type AdminActionState,
  initialAdminActionState,
} from "@/lib/admin/imported-runs/action-validation";
import {
  removeImportedVenueCreationVenueAction,
  updateImportedVenueCreationVenueAction,
} from "@/app/admin/imported-runs/actions";

type ImportedVenueActionsVenue = {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string | null;
  websiteUrl: string | null;
  phone: string | null;
};

type ImportedVenueActionsProps = {
  importedVenueCreationId: string;
  venue: ImportedVenueActionsVenue | null;
  removed: boolean;
};

function SubmitButton({
  children,
  pendingLabel,
  tone = "default",
}: {
  children: ReactNode;
  pendingLabel: string;
  tone?: "default" | "danger";
}) {
  const { pending } = useFormStatus();
  const toneClass =
    tone === "danger"
      ? "border-rose-400/40 text-rose-200 hover:border-rose-300/70 hover:bg-rose-500/10"
      : "border-emerald-400/40 text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-500/10";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function StateMessage({ state }: { state: AdminActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "text-xs font-medium text-emerald-200"
          : "text-xs font-medium text-rose-200"
      }
    >
      {state.message}
    </p>
  );
}

function fieldError(state: AdminActionState, field: string) {
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function TextField({
  state,
  label,
  name,
  defaultValue,
  type = "text",
}: {
  state: AdminActionState;
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  const error = fieldError(state, name);

  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-300">
      <span>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="min-w-0 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
      />
      {error ? <span className="text-rose-200">{error}</span> : null}
    </label>
  );
}

export function ImportedVenueActions({
  importedVenueCreationId,
  venue,
  removed,
}: ImportedVenueActionsProps) {
  const [updateState, updateAction] = useActionState(
    updateImportedVenueCreationVenueAction,
    initialAdminActionState,
  );
  const [removeState, removeAction] = useActionState(
    removeImportedVenueCreationVenueAction,
    initialAdminActionState,
  );

  if (removed || !venue) {
    return <span className="text-xs text-zinc-500">No actions</span>;
  }

  return (
    <div className="grid min-w-[260px] gap-3">
      <details className="group rounded-md border border-white/10 bg-zinc-950/70">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-emerald-200 hover:text-emerald-100">
          Change
        </summary>
        <form action={updateAction} className="grid gap-3 border-t border-white/10 p-3">
          <input
            type="hidden"
            name="importedVenueCreationId"
            value={importedVenueCreationId}
          />

          <TextField
            state={updateState}
            label="Name"
            name="name"
            defaultValue={venue.name}
          />
          <TextField
            state={updateState}
            label="Address"
            name="addressLine1"
            defaultValue={venue.addressLine1}
          />
          <TextField
            state={updateState}
            label="Address 2"
            name="addressLine2"
            defaultValue={venue.addressLine2 ?? ""}
          />
          <TextField
            state={updateState}
            label="City"
            name="city"
            defaultValue={venue.city}
          />
          <TextField
            state={updateState}
            label="Postal"
            name="postalCode"
            defaultValue={venue.postalCode ?? ""}
          />
          <TextField
            state={updateState}
            label="Website"
            name="websiteUrl"
            type="url"
            defaultValue={venue.websiteUrl ?? ""}
          />
          <TextField
            state={updateState}
            label="Phone"
            name="phone"
            defaultValue={venue.phone ?? ""}
          />

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Saving">Save</SubmitButton>
            <StateMessage state={updateState} />
          </div>
        </form>
      </details>

      <form
        action={removeAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Remove this imported venue? This will unlink the source reference and delete the Venue only if no runs use it.",
            )
          ) {
            event.preventDefault();
          }
        }}
        className="grid gap-2"
      >
        <input
          type="hidden"
          name="importedVenueCreationId"
          value={importedVenueCreationId}
        />
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Removing" tone="danger">
            Remove
          </SubmitButton>
          <StateMessage state={removeState} />
        </div>
      </form>
    </div>
  );
}
