import { z } from "zod";
import { normalizeAdminPostalCode } from "./venue-normalization";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
};

const optionalUrlSchema = z
  .string()
  .trim()
  .pipe(z.url("Source URL must be a valid URL"))
  .optional()
  .or(z.literal(""));

export const linkExternalVenueRefSchema = z.object({
  externalVenueRefId: z
    .string()
    .trim()
    .min(1, "External venue reference is required"),
  venueId: z.string().trim().min(1, "Venue is required"),
  batchId: z.string().trim().min(1, "Import batch is required").optional(),
});

export const createVenueFromExternalRefSchema = z.object({
  externalVenueRefId: z
    .string()
    .trim()
    .min(1, "External venue reference is required"),
  batchId: z.string().trim().min(1, "Import batch is required").optional(),
  name: z.string().trim().min(1, "Name is required"),
  addressLine1: z.string().trim().min(1, "Address is required"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required").default("Toronto"),
  postalCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => normalizeAdminPostalCode(value)),
  websiteUrl: optionalUrlSchema,
  phone: z.string().trim().optional(),
});

export type LinkExternalVenueRefInput = z.infer<
  typeof linkExternalVenueRefSchema
>;
export type CreateVenueFromExternalRefInput = z.infer<
  typeof createVenueFromExternalRefSchema
>;

export function formErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors;
}
