"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FIELD } from "@/app/_components/field";
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
  // Danger is carried by the border and label rather than a fill. This button
  // repeats on every row, and a few hundred solid red tiles stop reading as a
  // warning -- the colour has to be scarce to mean anything. The filled
  // danger variant stays for one-off destructive actions.
  const toneClass =
    tone === "danger"
      ? "border-danger bg-white text-danger"
      : "border-foreground bg-court text-foreground";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-[8px] border-2 px-3 py-1.5 text-xs font-semibold shadow-[0_3px_0_0_currentColor] transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:translate-y-[1px] hover:shadow-[0_2px_0_0_currentColor] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
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
          ? "text-xs font-semibold text-success"
          : "text-xs font-semibold text-danger"
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
    <label className="grid gap-1 text-xs font-medium text-foreground/70">
      <span>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className={FIELD}
      />
      {error ? <span className="font-semibold text-danger">{error}</span> : null}
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
    return <span className="text-xs text-foreground/60">No actions</span>;
  }

  return (
    <div className="grid min-w-[260px] gap-3">
      <details className="group rounded-[10px] border-2 border-foreground bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-foreground hover:text-link-hover">
          Change
        </summary>
        <form action={updateAction} className="grid gap-3 border-t-2 border-line p-3">
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
