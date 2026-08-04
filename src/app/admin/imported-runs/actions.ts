"use server";

import { revalidatePath } from "next/cache";
import {
  type AdminActionState,
  createVenueFromExternalRefSchema,
  formErrors,
  linkExternalVenueRefSchema,
  removeImportedVenueCreationVenueSchema,
  updateImportedVenueCreationVenueSchema,
} from "@/lib/admin/imported-runs/action-validation";
import { requireAdmin } from "@/server/admin";
import {
  VenueResolutionError,
  createVenueFromExternalVenueRef,
  linkExternalVenueRefToVenue,
  removeImportedVenueCreationVenue,
  updateImportedVenueCreationVenue,
} from "@/server/admin/imported-runs/venue-resolution";

function formString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : undefined;
}

function optionalFormString(formData: FormData, name: string) {
  const value = formString(formData, name);

  return value && value.trim() !== "" ? value : undefined;
}

function revalidateImportedRunAdminPaths(batchId?: string) {
  revalidatePath("/admin/imported-runs");
  revalidatePath("/admin/imported-venues");

  if (batchId) {
    revalidatePath(`/admin/imported-runs/${batchId}`);
  }

  revalidatePath("/admin/venues");
  revalidatePath("/admin/schedule-sources");
  revalidatePath("/runs/new");
}

function safeErrorState(error: unknown): AdminActionState {
  if (error instanceof VenueResolutionError) {
    return {
      status: "error",
      message: error.message,
    };
  }

  console.error(error);

  return {
    status: "error",
    message: "Venue resolution failed. Please check the fields and try again.",
  };
}

export async function linkExternalVenueRefAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const result = linkExternalVenueRefSchema.safeParse({
    externalVenueRefId: formString(formData, "externalVenueRefId"),
    venueId: formString(formData, "venueId"),
    batchId: optionalFormString(formData, "batchId"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: "Please check the venue link fields.",
      fieldErrors: formErrors(result.error),
    };
  }

  try {
    await linkExternalVenueRefToVenue(result.data);
    revalidateImportedRunAdminPaths(result.data.batchId);

    return {
      status: "success",
      message: "Source location linked to the selected Venue.",
    };
  } catch (error) {
    return safeErrorState(error);
  }
}

export async function createVenueFromExternalRefAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const result = createVenueFromExternalRefSchema.safeParse({
    externalVenueRefId: formString(formData, "externalVenueRefId"),
    batchId: optionalFormString(formData, "batchId"),
    name: formString(formData, "name"),
    addressLine1: formString(formData, "addressLine1"),
    addressLine2: optionalFormString(formData, "addressLine2"),
    city: formString(formData, "city"),
    postalCode: formString(formData, "postalCode"),
    websiteUrl: formString(formData, "websiteUrl"),
    phone: optionalFormString(formData, "phone"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: "Please check the venue fields.",
      fieldErrors: formErrors(result.error),
    };
  }

  try {
    await createVenueFromExternalVenueRef(result.data);
    revalidateImportedRunAdminPaths(result.data.batchId);

    return {
      status: "success",
      message: "Venue created and linked to the source location.",
    };
  } catch (error) {
    return safeErrorState(error);
  }
}

export async function updateImportedVenueCreationVenueAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const result = updateImportedVenueCreationVenueSchema.safeParse({
    importedVenueCreationId: formString(formData, "importedVenueCreationId"),
    name: formString(formData, "name"),
    addressLine1: formString(formData, "addressLine1"),
    addressLine2: optionalFormString(formData, "addressLine2"),
    city: formString(formData, "city"),
    postalCode: formString(formData, "postalCode"),
    websiteUrl: formString(formData, "websiteUrl"),
    phone: optionalFormString(formData, "phone"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: "Please check the venue fields.",
      fieldErrors: formErrors(result.error),
    };
  }

  try {
    await updateImportedVenueCreationVenue(result.data);
    revalidateImportedRunAdminPaths();

    return {
      status: "success",
      message: "Imported venue updated.",
    };
  } catch (error) {
    return safeErrorState(error);
  }
}

export async function removeImportedVenueCreationVenueAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const result = removeImportedVenueCreationVenueSchema.safeParse({
    importedVenueCreationId: formString(formData, "importedVenueCreationId"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: "Please check the imported venue.",
      fieldErrors: formErrors(result.error),
    };
  }

  try {
    await removeImportedVenueCreationVenue(result.data);
    revalidateImportedRunAdminPaths();

    return {
      status: "success",
      message: "Imported venue removed and source reference ignored.",
    };
  } catch (error) {
    return safeErrorState(error);
  }
}
