import { z } from "zod";
import {
  AgeGroup,
  ImportReviewStatus,
  RunSourceType,
  SkillLevel,
  SourceRunStatus,
} from "@/generated/prisma/enums";

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Expected a valid date string",
  })
  .transform((value) => new Date(value));

const nullableDateStringSchema = dateStringSchema.optional().nullable();

const decimalInputSchema = z
  .union([
    z.number().finite(),
    z.string().trim().regex(/^\d+(\.\d{1,2})?$/),
    z.null(),
  ])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined || value === "") {
      return null;
    }

    return value;
  });

export const importRunApplyPayloadSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  sourceType: z.enum([
    RunSourceType.CITY,
    RunSourceType.UNIVERSITY,
    RunSourceType.USER,
  ]),
  startTime: dateStringSchema,
  endTime: dateStringSchema,
  price: decimalInputSchema,
  skillLevel: z.enum([
    SkillLevel.BEGINNER,
    SkillLevel.INTERMEDIATE,
    SkillLevel.ADVANCED,
    SkillLevel.OPEN,
  ]),
  ageGroup: z.enum([
    AgeGroup.ALL_AGES,
    AgeGroup.YOUTH,
    AgeGroup.ADULT,
    AgeGroup.SENIOR,
  ]),
  maxPlayers: z.number().int().positive().optional().nullable(),
  verified: z.boolean(),
  sourceUrl: z.string().optional().nullable(),
  sourceExternalId: z.string().trim().min(1),
  sourceSeriesId: z.string().optional().nullable(),
  sourceFingerprint: z.string().trim().min(1),
  sourceStatus: z
    .enum([
      SourceRunStatus.ACTIVE,
      SourceRunStatus.STALE,
      SourceRunStatus.REMOVED,
      SourceRunStatus.CANCELLED,
    ])
    .default(SourceRunStatus.ACTIVE),
  reviewStatus: z
    .enum([
      ImportReviewStatus.PENDING,
      ImportReviewStatus.APPROVED,
      ImportReviewStatus.REJECTED,
      ImportReviewStatus.AUTO_APPROVED,
    ])
    .default(ImportReviewStatus.PENDING),
  sourceAgeLabel: z.string().optional().nullable(),
  sourceMinAge: z.number().int().optional().nullable(),
  sourceMaxAge: z.number().int().optional().nullable(),
  sourceFirstSeenAt: nullableDateStringSchema,
  sourceLastSeenAt: nullableDateStringSchema,
  venueId: z.string().trim().min(1),
  scheduleSourceId: z.string().trim().min(1),
});

export type ImportRunApplyPayload = z.infer<
  typeof importRunApplyPayloadSchema
>;

export function parseImportRunApplyPayload(payload: unknown) {
  return importRunApplyPayloadSchema.safeParse(payload);
}
