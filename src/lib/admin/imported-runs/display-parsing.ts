import { z } from "zod";
import {
  ImportItemAction,
  ImportReviewStatus,
  VenueMatchStatus,
} from "@/generated/prisma/enums";

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const importFieldDiffDisplaySchema = z.object({
  field: z.string().trim().min(1),
  current: jsonPrimitiveSchema.optional().nullable(),
  proposed: jsonPrimitiveSchema.optional().nullable(),
});

const importLocationDisplaySchema = z.object({
  sourceLocationId: z.string().optional().nullable(),
  sourceName: z.string().optional().nullable(),
  sourceAddressLine1: z.string().optional().nullable(),
  sourcePostalCode: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
});

export const importItemPayloadDisplaySchema = z.object({
  title: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  sourceLocationId: z.string().optional().nullable(),
  externalVenueRefId: z.string().optional().nullable(),
  venueMatchStatus: z
    .enum([
      VenueMatchStatus.MATCHED,
      VenueMatchStatus.PENDING,
      VenueMatchStatus.IGNORED,
    ])
    .optional()
    .nullable(),
  venueMatchReason: z.string().optional().nullable(),
  location: importLocationDisplaySchema.optional().nullable(),
});

export const importItemDisplaySchema = z.object({
  id: z.string(),
  sourceKey: z.string(),
  sourceOccurrenceId: z.string().nullable(),
  sourceSeriesId: z.string().nullable(),
  action: z.enum([
    ImportItemAction.CREATE,
    ImportItemAction.UPDATE,
    ImportItemAction.UNCHANGED,
    ImportItemAction.MISSING,
    ImportItemAction.SKIPPED,
    ImportItemAction.ERROR,
  ]),
  reviewStatus: z.enum([
    ImportReviewStatus.PENDING,
    ImportReviewStatus.APPROVED,
    ImportReviewStatus.REJECTED,
    ImportReviewStatus.AUTO_APPROVED,
  ]),
  runId: z.string().nullable(),
  normalizedPayload: z.unknown().nullable(),
  fieldDiff: z.unknown().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ImportItemPayloadDisplay = z.infer<
  typeof importItemPayloadDisplaySchema
>;
export type ImportFieldDiffDisplay = z.infer<
  typeof importFieldDiffDisplaySchema
>;

export function parseImportItemPayloadDisplay(
  payload: unknown,
): ImportItemPayloadDisplay | null {
  const result = importItemPayloadDisplaySchema.safeParse(payload);

  return result.success ? result.data : null;
}

export function parseImportFieldDiffDisplay(
  fieldDiff: unknown,
): ImportFieldDiffDisplay[] {
  const result = z.array(importFieldDiffDisplaySchema).safeParse(fieldDiff);

  return result.success ? result.data : [];
}
