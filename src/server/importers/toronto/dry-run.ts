import "server-only";

import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  ImportBatchMode,
  ImportBatchStatus,
  ImportItemAction,
  ImportReviewStatus,
  RunSourceType,
  SourceRunStatus,
  VenueMatchStatus,
} from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import {
  type CkanPackage,
  type CkanResource,
  type DatastorePage,
  TORONTO_CKAN_PACKAGE_ID,
  createTorontoCkanClient,
  type TorontoCkanClient,
} from "./ckan";
import {
  normalizeTorontoDropInRunCandidates,
  normalizeTorontoLocationRow,
  torontoLocationRowSchema,
  type NormalizedRunCandidate,
  type NormalizedTorontoLocation,
  type TorontoDropInSkippedRow,
} from "./normalization";
import { findOrCreateTorontoExternalVenueRef } from "./venues";

const TORONTO_DROP_IN_PROVIDER_KEY = "toronto-drop-in";
const TORONTO_DROP_IN_SOURCE_URL =
  "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";

type TorontoDryRunPrisma = Pick<
  PrismaClient,
  | "scheduleSource"
  | "importBatch"
  | "importItem"
  | "run"
  | "externalVenueRef"
  | "venue"
>;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export type TorontoSourceHealthIssue = {
  code:
    | "DROP_IN_EMPTY"
    | "DROP_IN_TOTAL_MISMATCH"
    | "LOCATIONS_EMPTY"
    | "LOCATIONS_TOTAL_MISMATCH"
    | "FACILITIES_TOTAL_MISMATCH";
  severity: "error";
  message: string;
};

export type TorontoSourceHealth = {
  isCompleteSnapshot: boolean;
  issues: TorontoSourceHealthIssue[];
};

export type TorontoDuplicateSourceOccurrence = {
  sourceOccurrenceId: string;
  candidateCount: number;
  sourceKeys: string[];
  fingerprints: string[];
  isConflicting: boolean;
};

export type TorontoImportFieldDiff = {
  field: string;
  current: JsonPrimitive;
  proposed: JsonPrimitive;
};

export type TorontoDryRunImportSummary = {
  batchId: string;
  scheduleSourceId: string;
  status: (typeof ImportBatchStatus)[keyof typeof ImportBatchStatus];
  isCompleteSnapshot: boolean;
  snapshotHash: string | null;
  startedAt: string;
  completedAt: string;
  sourceHealth: TorontoSourceHealth;
  duplicates: TorontoDuplicateSourceOccurrence[];
  counts: {
    dropInRecordCount: number;
    locationsRecordCount: number;
    facilitiesRecordCount: number;
    basketballRecordCount: number;
    createdCount: number;
    updatedCount: number;
    unchangedCount: number;
    skippedCount: number;
    errorCount: number;
  };
  resources: {
    dropInResourceId: string | null;
    locationsResourceId: string | null;
    facilitiesResourceId: string | null;
  };
};

export type RunTorontoDryRunImportOptions = {
  db?: TorontoDryRunPrisma;
  ckanClient?: TorontoCkanClient;
  trigger?: string;
  now?: Date;
};

type ExistingImportedRun = {
  id: string;
  title: string;
  description: string | null;
  sourceType: (typeof RunSourceType)[keyof typeof RunSourceType];
  startTime: Date;
  endTime: Date;
  price: unknown;
  skillLevel: string;
  ageGroup: string;
  maxPlayers: number | null;
  verified: boolean;
  sourceUrl: string | null;
  sourceExternalId: string | null;
  sourceSeriesId: string | null;
  sourceFingerprint: string | null;
  sourceAgeLabel: string | null;
  sourceMinAge: number | null;
  sourceMaxAge: number | null;
  venueId: string;
};

type ImportItemDraft = {
  sourceKey: string;
  sourceOccurrenceId?: string;
  sourceSeriesId?: string;
  action: (typeof ImportItemAction)[keyof typeof ImportItemAction];
  reviewStatus: (typeof ImportReviewStatus)[keyof typeof ImportReviewStatus];
  runId?: string;
  rawPayload?: JsonObject;
  normalizedPayload?: JsonObject;
  fieldDiff?: TorontoImportFieldDiff[];
  errorMessage?: string;
};

type LocationIndex = {
  locationsById: Map<string, NormalizedTorontoLocation>;
  errors: ImportItemDraft[];
};

type CkanSnapshot = {
  pkg: CkanPackage;
  dropInResource: CkanResource;
  locationsResource: CkanResource;
  facilitiesResource: CkanResource;
  dropInPage: DatastorePage;
  locationsPage: DatastorePage;
  facilitiesPage: DatastorePage;
};

function toCanonicalJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, item]) => [key, toCanonicalJsonValue(item)]),
    );
  }

  return String(value);
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(toCanonicalJsonValue(value));
}

export function createTorontoSnapshotHash(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}

function resourceModifiedAt(resource: CkanResource): Date | null {
  const value =
    resource.last_modified ??
    resource.last_modified_date ??
    resource.metadata_modified;

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summarizeResourceForHash(resource: CkanResource): JsonObject {
  return {
    id: resource.id,
    name: resource.name,
    format: resource.format ?? null,
    datastoreActive: resource.datastore_active ?? null,
    lastModified: resource.last_modified ?? null,
    lastModifiedDate: resource.last_modified_date ?? null,
    metadataModified: resource.metadata_modified ?? null,
  };
}

export function evaluateTorontoSourceHealth({
  dropInPage,
  locationsPage,
  facilitiesPage,
}: {
  dropInPage: Pick<DatastorePage, "records" | "total">;
  locationsPage: Pick<DatastorePage, "records" | "total">;
  facilitiesPage: Pick<DatastorePage, "records" | "total">;
}): TorontoSourceHealth {
  const issues: TorontoSourceHealthIssue[] = [];

  if (dropInPage.records.length === 0) {
    issues.push({
      code: "DROP_IN_EMPTY",
      severity: "error",
      message: "Toronto Drop-in resource returned zero records.",
    });
  }

  if (dropInPage.records.length !== dropInPage.total) {
    issues.push({
      code: "DROP_IN_TOTAL_MISMATCH",
      severity: "error",
      message: `Toronto Drop-in resource returned ${dropInPage.records.length} records but reported total ${dropInPage.total}.`,
    });
  }

  if (locationsPage.records.length === 0) {
    issues.push({
      code: "LOCATIONS_EMPTY",
      severity: "error",
      message: "Toronto Locations resource returned zero records.",
    });
  }

  if (locationsPage.records.length !== locationsPage.total) {
    issues.push({
      code: "LOCATIONS_TOTAL_MISMATCH",
      severity: "error",
      message: `Toronto Locations resource returned ${locationsPage.records.length} records but reported total ${locationsPage.total}.`,
    });
  }

  if (facilitiesPage.records.length !== facilitiesPage.total) {
    issues.push({
      code: "FACILITIES_TOTAL_MISMATCH",
      severity: "error",
      message: `Toronto Facilities resource returned ${facilitiesPage.records.length} records but reported total ${facilitiesPage.total}.`,
    });
  }

  return {
    isCompleteSnapshot: issues.length === 0,
    issues,
  };
}

function buildSnapshotHash(snapshot: CkanSnapshot): string {
  return createTorontoSnapshotHash({
    package: {
      id: snapshot.pkg.id,
      name: snapshot.pkg.name,
      title: snapshot.pkg.title ?? null,
      metadataModified: snapshot.pkg.metadata_modified ?? null,
    },
    resources: {
      dropIn: summarizeResourceForHash(snapshot.dropInResource),
      locations: summarizeResourceForHash(snapshot.locationsResource),
      facilities: summarizeResourceForHash(snapshot.facilitiesResource),
    },
    pages: {
      dropIn: {
        total: snapshot.dropInPage.total,
        records: snapshot.dropInPage.records,
      },
      locations: {
        total: snapshot.locationsPage.total,
        records: snapshot.locationsPage.records,
      },
      facilities: {
        total: snapshot.facilitiesPage.total,
        records: snapshot.facilitiesPage.records,
      },
    },
  });
}

function rawRecordId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = (value as Record<string, unknown>)._id;

  if (typeof id === "string" || typeof id === "number") {
    return String(id);
  }

  return null;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeLocationIndex(records: unknown[]): LocationIndex {
  const locationsById = new Map<string, NormalizedTorontoLocation>();
  const errors: ImportItemDraft[] = [];
  const usedSourceKeys = new Set<string>();

  records.forEach((rawSource, index) => {
    const rowResult = torontoLocationRowSchema.safeParse(rawSource);
    const rawId = rawRecordId(rawSource);
    const sourceKey = makeUniqueSourceKey(
      rawId ? `location-row:${rawId}` : `location-row-index:${index}`,
      usedSourceKeys,
    );

    if (!rowResult.success) {
      errors.push({
        sourceKey,
        action: ImportItemAction.SKIPPED,
        reviewStatus: ImportReviewStatus.PENDING,
        rawPayload: {
          kind: "location_row",
          rawSource: toCanonicalJsonValue(rawSource),
        },
        errorMessage: rowResult.error.issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "row";
            return `${path}: ${issue.message}`;
          })
          .join("; "),
      });
      return;
    }

    try {
      const location = normalizeTorontoLocationRow(rowResult.data);
      if (locationsById.has(location.sourceLocationId)) {
        errors.push({
          sourceKey,
          action: ImportItemAction.SKIPPED,
          reviewStatus: ImportReviewStatus.PENDING,
          rawPayload: {
            kind: "location_row",
            rawSource: toCanonicalJsonValue(rawSource),
          },
          normalizedPayload: serializeLocation(location),
          errorMessage: `Duplicate Toronto location id ${location.sourceLocationId}.`,
        });
        return;
      }

      locationsById.set(location.sourceLocationId, location);
    } catch (error) {
      errors.push({
        sourceKey,
        action: ImportItemAction.SKIPPED,
        reviewStatus: ImportReviewStatus.PENDING,
        rawPayload: {
          kind: "location_row",
          rawSource: toCanonicalJsonValue(rawSource),
        },
        errorMessage: formatUnknownError(error),
      });
    }
  });

  return { locationsById, errors };
}

function makeUniqueSourceKey(sourceKey: string, usedSourceKeys: Set<string>): string {
  if (!usedSourceKeys.has(sourceKey)) {
    usedSourceKeys.add(sourceKey);
    return sourceKey;
  }

  let suffix = 2;
  let nextSourceKey = `${sourceKey}#${suffix}`;

  while (usedSourceKeys.has(nextSourceKey)) {
    suffix += 1;
    nextSourceKey = `${sourceKey}#${suffix}`;
  }

  usedSourceKeys.add(nextSourceKey);
  return nextSourceKey;
}

function sourceKeyForCandidate(candidate: NormalizedRunCandidate): string {
  return candidate.sourceExternalId;
}

function sourceKeyForSkippedRow(
  skipped: TorontoDropInSkippedRow,
  index: number,
): string {
  const rawId = rawRecordId(skipped.rawSource);
  return rawId ? `drop-in-row:${rawId}` : `drop-in-skipped:${index}`;
}

export function findDuplicateTorontoSourceOccurrences(
  candidates: NormalizedRunCandidate[],
): TorontoDuplicateSourceOccurrence[] {
  const candidatesByOccurrence = new Map<string, NormalizedRunCandidate[]>();

  for (const candidate of candidates) {
    const existing = candidatesByOccurrence.get(candidate.sourceExternalId) ?? [];
    existing.push(candidate);
    candidatesByOccurrence.set(candidate.sourceExternalId, existing);
  }

  return Array.from(candidatesByOccurrence.entries())
    .filter(([, group]) => group.length > 1)
    .map(([sourceOccurrenceId, group]) => {
      const fingerprints = Array.from(
        new Set(group.map((candidate) => candidate.sourceFingerprint)),
      ).sort();

      return {
        sourceOccurrenceId,
        candidateCount: group.length,
        sourceKeys: group.map(sourceKeyForCandidate).sort(),
        fingerprints,
        isConflicting: fingerprints.length > 1,
      };
    })
    .sort((left, right) =>
      left.sourceOccurrenceId.localeCompare(right.sourceOccurrenceId),
    );
}

function candidateIds(candidates: NormalizedRunCandidate[]): string[] {
  return Array.from(
    new Set(candidates.map((candidate) => candidate.sourceExternalId)),
  ).sort();
}

async function findExistingImportedRuns(
  db: TorontoDryRunPrisma,
  scheduleSourceId: string,
  candidates: NormalizedRunCandidate[],
): Promise<Map<string, ExistingImportedRun>> {
  const sourceExternalIds = candidateIds(candidates);

  if (sourceExternalIds.length === 0) {
    return new Map();
  }

  const runs = await db.run.findMany({
    where: {
      scheduleSourceId,
      sourceExternalId: {
        in: sourceExternalIds,
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      sourceType: true,
      startTime: true,
      endTime: true,
      price: true,
      skillLevel: true,
      ageGroup: true,
      maxPlayers: true,
      verified: true,
      sourceUrl: true,
      sourceExternalId: true,
      sourceSeriesId: true,
      sourceFingerprint: true,
      sourceAgeLabel: true,
      sourceMinAge: true,
      sourceMaxAge: true,
      venueId: true,
    },
  });

  return new Map(
    runs.flatMap((run) => {
      return run.sourceExternalId ? [[run.sourceExternalId, run]] : [];
    }),
  );
}

function comparableValue(value: unknown): JsonPrimitive {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && "toString" in value) {
    return String(value);
  }

  return String(value);
}

function buildProposedRunFields(
  candidate: NormalizedRunCandidate,
  venueId: string,
): Record<string, JsonPrimitive> {
  return {
    title: candidate.title,
    description: candidate.description,
    sourceType: candidate.sourceType,
    startTime: candidate.startTime.toISOString(),
    endTime: candidate.endTime.toISOString(),
    price: candidate.price,
    skillLevel: candidate.skillLevel,
    ageGroup: candidate.ageGroup,
    maxPlayers: candidate.maxPlayers,
    verified: true,
    sourceUrl: candidate.sourceUrl,
    sourceExternalId: candidate.sourceExternalId,
    sourceSeriesId: candidate.sourceSeriesId,
    sourceFingerprint: candidate.sourceFingerprint,
    sourceAgeLabel: candidate.sourceAgeLabel,
    sourceMinAge: candidate.sourceMinAge,
    sourceMaxAge: candidate.sourceMaxAge,
    venueId,
  };
}

export function diffTorontoRunCandidate(
  candidate: NormalizedRunCandidate,
  existingRun: ExistingImportedRun,
  venueId: string,
): TorontoImportFieldDiff[] {
  const proposed = buildProposedRunFields(candidate, venueId);
  const current: Record<string, JsonPrimitive> = {
    title: existingRun.title,
    description: existingRun.description,
    sourceType: existingRun.sourceType,
    startTime: existingRun.startTime.toISOString(),
    endTime: existingRun.endTime.toISOString(),
    price: comparableValue(existingRun.price),
    skillLevel: existingRun.skillLevel,
    ageGroup: existingRun.ageGroup,
    maxPlayers: existingRun.maxPlayers,
    verified: existingRun.verified,
    sourceUrl: existingRun.sourceUrl,
    sourceExternalId: existingRun.sourceExternalId,
    sourceSeriesId: existingRun.sourceSeriesId,
    sourceFingerprint: existingRun.sourceFingerprint,
    sourceAgeLabel: existingRun.sourceAgeLabel,
    sourceMinAge: existingRun.sourceMinAge,
    sourceMaxAge: existingRun.sourceMaxAge,
    venueId: existingRun.venueId,
  };

  return Object.entries(proposed).flatMap(([field, proposedValue]) => {
    const currentValue = current[field] ?? null;

    if (currentValue === proposedValue) {
      return [];
    }

    return [
      {
        field,
        current: currentValue,
        proposed: proposedValue,
      },
    ];
  });
}

function serializeCandidate(
  candidate: NormalizedRunCandidate,
  options: {
    scheduleSourceId: string;
    venueId: string | null;
    externalVenueRefId: string | null;
    venueMatchStatus: (typeof VenueMatchStatus)[keyof typeof VenueMatchStatus];
    seenAt: Date;
  },
): JsonObject {
  return {
    ...buildProposedRunFields(candidate, options.venueId ?? ""),
    venueId: options.venueId,
    scheduleSourceId: options.scheduleSourceId,
    sourceStatus: SourceRunStatus.ACTIVE,
    sourceFirstSeenAt: options.seenAt.toISOString(),
    sourceLastSeenAt: options.seenAt.toISOString(),
    sourceLocationId: candidate.sourceLocationId,
    externalVenueRefId: options.externalVenueRefId,
    venueMatchStatus: options.venueMatchStatus,
  };
}

function serializeLocation(location: NormalizedTorontoLocation): JsonObject {
  return {
    sourceLocationId: location.sourceLocationId,
    sourceName: location.sourceName,
    sourceAddressLine1: location.sourceAddressLine1,
    sourcePostalCode: location.sourcePostalCode,
    sourceUrl: location.sourceUrl,
  };
}

function skippedDropInItems(
  skippedRows: TorontoDropInSkippedRow[],
  usedSourceKeys: Set<string>,
): ImportItemDraft[] {
  return skippedRows.flatMap((skipped, index) => {
    if (skipped.reason === "not_basketball") {
      return [];
    }

    return [
      {
        sourceKey: makeUniqueSourceKey(
          sourceKeyForSkippedRow(skipped, index),
          usedSourceKeys,
        ),
        action: ImportItemAction.SKIPPED,
        reviewStatus: ImportReviewStatus.PENDING,
        rawPayload: {
          kind: "drop_in_row",
          reason: skipped.reason,
          rawSource: toCanonicalJsonValue(skipped.rawSource),
        },
        errorMessage: skipped.message,
      },
    ];
  });
}

function countBasketballRecords(skippedRows: TorontoDropInSkippedRow[]): number {
  return skippedRows.filter((skipped) => skipped.reason !== "not_basketball")
    .length;
}

function summarizeImportItems(items: ImportItemDraft[]) {
  return {
    createdCount: items.filter((item) => item.action === ImportItemAction.CREATE)
      .length,
    updatedCount: items.filter((item) => item.action === ImportItemAction.UPDATE)
      .length,
    unchangedCount: items.filter(
      (item) => item.action === ImportItemAction.UNCHANGED,
    ).length,
    skippedCount: items.filter((item) => item.action === ImportItemAction.SKIPPED)
      .length,
    errorCount: items.filter((item) => item.action === ImportItemAction.ERROR)
      .length,
  };
}

function determineBatchStatus(
  health: TorontoSourceHealth,
  counts: ReturnType<typeof summarizeImportItems>,
): (typeof ImportBatchStatus)[keyof typeof ImportBatchStatus] {
  if (!health.isCompleteSnapshot) {
    return ImportBatchStatus.FAILED;
  }

  if (counts.errorCount > 0 || counts.skippedCount > 0) {
    return ImportBatchStatus.PARTIAL;
  }

  return ImportBatchStatus.SUCCEEDED;
}

function errorSummary(
  health: TorontoSourceHealth,
  items: ImportItemDraft[],
): string | null {
  const messages = [
    ...health.issues.map((issue) => issue.message),
    ...items.flatMap((item) => {
      return item.action === ImportItemAction.ERROR && item.errorMessage
        ? [item.errorMessage]
        : [];
    }),
  ];

  return messages.length > 0 ? messages.slice(0, 5).join(" | ") : null;
}

async function createImportItems(
  db: TorontoDryRunPrisma,
  batchId: string,
  items: ImportItemDraft[],
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  await db.importItem.createMany({
    data: items.map((item) => ({
      batchId,
      sourceKey: item.sourceKey,
      sourceOccurrenceId: item.sourceOccurrenceId,
      sourceSeriesId: item.sourceSeriesId,
      action: item.action,
      reviewStatus: item.reviewStatus,
      runId: item.runId,
      rawPayload: item.rawPayload,
      normalizedPayload: item.normalizedPayload,
      fieldDiff: item.fieldDiff,
      errorMessage: item.errorMessage,
    })),
  });
}

async function processCandidates({
  db,
  scheduleSourceId,
  seenAt,
  candidates,
  duplicateSourceOccurrenceIds,
  locationsById,
  existingRunsByExternalId,
  usedSourceKeys,
}: {
  db: TorontoDryRunPrisma;
  scheduleSourceId: string;
  seenAt: Date;
  candidates: NormalizedRunCandidate[];
  duplicateSourceOccurrenceIds: Set<string>;
  locationsById: Map<string, NormalizedTorontoLocation>;
  existingRunsByExternalId: Map<string, ExistingImportedRun>;
  usedSourceKeys: Set<string>;
}): Promise<ImportItemDraft[]> {
  const items: ImportItemDraft[] = [];

  for (const candidate of candidates) {
    const sourceKey = makeUniqueSourceKey(
      sourceKeyForCandidate(candidate),
      usedSourceKeys,
    );

    if (duplicateSourceOccurrenceIds.has(candidate.sourceExternalId)) {
      items.push({
        sourceKey,
        sourceOccurrenceId: candidate.sourceExternalId,
        sourceSeriesId: candidate.sourceSeriesId,
        action: ImportItemAction.SKIPPED,
        reviewStatus: ImportReviewStatus.PENDING,
        rawPayload: {
          kind: "drop_in_row",
          rawSource: toCanonicalJsonValue(candidate.rawSource),
        },
        normalizedPayload: serializeCandidate(candidate, {
          scheduleSourceId,
          venueId: null,
          externalVenueRefId: null,
          venueMatchStatus: VenueMatchStatus.PENDING,
          seenAt,
        }),
        errorMessage: `Duplicate Toronto source occurrence ${candidate.sourceExternalId}.`,
      });
      continue;
    }

    try {
      const location = locationsById.get(candidate.sourceLocationId);

      if (!location) {
        items.push({
          sourceKey,
          sourceOccurrenceId: candidate.sourceExternalId,
          sourceSeriesId: candidate.sourceSeriesId,
          action: ImportItemAction.SKIPPED,
          reviewStatus: ImportReviewStatus.PENDING,
          rawPayload: {
            kind: "drop_in_row",
            rawSource: toCanonicalJsonValue(candidate.rawSource),
          },
          normalizedPayload: serializeCandidate(candidate, {
            scheduleSourceId,
            venueId: null,
            externalVenueRefId: null,
            venueMatchStatus: VenueMatchStatus.PENDING,
            seenAt,
          }),
          errorMessage: `No Toronto location row found for Location ID ${candidate.sourceLocationId}.`,
        });
        continue;
      }

      const venueRef = await findOrCreateTorontoExternalVenueRef({
        scheduleSourceId,
        location,
        seenAt,
        db,
      });

      if (venueRef.status !== VenueMatchStatus.MATCHED) {
        items.push({
          sourceKey,
          sourceOccurrenceId: candidate.sourceExternalId,
          sourceSeriesId: candidate.sourceSeriesId,
          action: ImportItemAction.SKIPPED,
          reviewStatus: ImportReviewStatus.PENDING,
          rawPayload: {
            kind: "drop_in_row",
            rawSource: toCanonicalJsonValue(candidate.rawSource),
          },
          normalizedPayload: {
            ...serializeCandidate(candidate, {
              scheduleSourceId,
              venueId: null,
              externalVenueRefId: venueRef.externalVenueRef.id,
              venueMatchStatus: venueRef.status,
              seenAt,
            }),
            location: serializeLocation(location),
            venueMatchReason: venueRef.reason,
          },
          errorMessage: `Toronto location ${candidate.sourceLocationId} is pending venue match: ${venueRef.reason}.`,
        });
        continue;
      }

      const existingRun = existingRunsByExternalId.get(candidate.sourceExternalId);
      const normalizedPayload = {
        ...serializeCandidate(candidate, {
          scheduleSourceId,
          venueId: venueRef.venueId,
          externalVenueRefId: venueRef.externalVenueRef.id,
          venueMatchStatus: venueRef.status,
          seenAt,
        }),
        location: serializeLocation(location),
        venueMatchReason: venueRef.reason,
      };

      if (!existingRun) {
        items.push({
          sourceKey,
          sourceOccurrenceId: candidate.sourceExternalId,
          sourceSeriesId: candidate.sourceSeriesId,
          action: ImportItemAction.CREATE,
          reviewStatus: ImportReviewStatus.PENDING,
          rawPayload: {
            kind: "drop_in_row",
            rawSource: toCanonicalJsonValue(candidate.rawSource),
          },
          normalizedPayload,
        });
        continue;
      }

      const fieldDiff = diffTorontoRunCandidate(
        candidate,
        existingRun,
        venueRef.venueId,
      );

      items.push({
        sourceKey,
        sourceOccurrenceId: candidate.sourceExternalId,
        sourceSeriesId: candidate.sourceSeriesId,
        action:
          fieldDiff.length === 0
            ? ImportItemAction.UNCHANGED
            : ImportItemAction.UPDATE,
        reviewStatus:
          fieldDiff.length === 0
            ? ImportReviewStatus.AUTO_APPROVED
            : ImportReviewStatus.PENDING,
        runId: existingRun.id,
        rawPayload: {
          kind: "drop_in_row",
          rawSource: toCanonicalJsonValue(candidate.rawSource),
        },
        normalizedPayload,
        fieldDiff,
      });
    } catch (error) {
      items.push({
        sourceKey,
        sourceOccurrenceId: candidate.sourceExternalId,
        sourceSeriesId: candidate.sourceSeriesId,
        action: ImportItemAction.ERROR,
        reviewStatus: ImportReviewStatus.PENDING,
        rawPayload: {
          kind: "drop_in_row",
          rawSource: toCanonicalJsonValue(candidate.rawSource),
        },
        normalizedPayload: serializeCandidate(candidate, {
          scheduleSourceId,
          venueId: null,
          externalVenueRefId: null,
          venueMatchStatus: VenueMatchStatus.PENDING,
          seenAt,
        }),
        errorMessage: formatUnknownError(error),
      });
    }
  }

  return items;
}

async function findTorontoScheduleSource(db: TorontoDryRunPrisma) {
  const byProviderKey = await db.scheduleSource.findUnique({
    where: {
      providerKey: TORONTO_DROP_IN_PROVIDER_KEY,
    },
    select: {
      id: true,
    },
  });

  if (byProviderKey) {
    return byProviderKey;
  }

  const byUrl = await db.scheduleSource.findUnique({
    where: {
      url: TORONTO_DROP_IN_SOURCE_URL,
    },
    select: {
      id: true,
    },
  });

  if (byUrl) {
    return byUrl;
  }

  throw new Error(
    `Could not find Toronto Drop-in schedule source. Expected providerKey "${TORONTO_DROP_IN_PROVIDER_KEY}" or URL "${TORONTO_DROP_IN_SOURCE_URL}".`,
  );
}

async function fetchTorontoSnapshot(
  ckanClient: TorontoCkanClient,
): Promise<CkanSnapshot> {
  const pkg = await ckanClient.getPackage();
  const dropInResource = await ckanClient.findDropInResource(pkg);
  const locationsResource = await ckanClient.findLocationsResource(pkg);
  const facilitiesResource = await ckanClient.findFacilitiesResource(pkg);
  const [dropInPage, locationsPage, facilitiesPage] = await Promise.all([
    ckanClient.fetchAllDatastoreRecords(dropInResource),
    ckanClient.fetchAllDatastoreRecords(locationsResource),
    ckanClient.fetchAllDatastoreRecords(facilitiesResource),
  ]);

  return {
    pkg,
    dropInResource,
    locationsResource,
    facilitiesResource,
    dropInPage,
    locationsPage,
    facilitiesPage,
  };
}

async function failBatch(
  db: TorontoDryRunPrisma,
  batchId: string,
  completedAt: Date,
  error: unknown,
): Promise<void> {
  await db.importBatch.update({
    where: {
      id: batchId,
    },
    data: {
      status: ImportBatchStatus.FAILED,
      completedAt,
      errorSummary: formatUnknownError(error),
    },
  });
}

export async function runTorontoDryRunImport({
  db = defaultPrisma,
  ckanClient = createTorontoCkanClient(),
  trigger = "local",
  now = new Date(),
}: RunTorontoDryRunImportOptions = {}): Promise<TorontoDryRunImportSummary> {
  const seenAt = new Date(now);
  const scheduleSource = await findTorontoScheduleSource(db);
  const batch = await db.importBatch.create({
    data: {
      scheduleSourceId: scheduleSource.id,
      trigger,
      mode: ImportBatchMode.DRY_RUN,
      status: ImportBatchStatus.RUNNING,
      startedAt: seenAt,
    },
    select: {
      id: true,
      startedAt: true,
    },
  });

  try {
    const snapshot = await fetchTorontoSnapshot(ckanClient);
    const health = evaluateTorontoSourceHealth(snapshot);
    const snapshotHash = buildSnapshotHash(snapshot);
    const usedSourceKeys = new Set<string>();
    const locationIndex = normalizeLocationIndex(snapshot.locationsPage.records);
    const normalization = normalizeTorontoDropInRunCandidates(
      snapshot.dropInPage.records,
    );
    const duplicates = findDuplicateTorontoSourceOccurrences(
      normalization.candidates,
    );
    const duplicateSourceOccurrenceIds = new Set(
      duplicates.map((duplicate) => duplicate.sourceOccurrenceId),
    );
    const existingRunsByExternalId = await findExistingImportedRuns(
      db,
      scheduleSource.id,
      normalization.candidates,
    );
    const items = [
      ...locationIndex.errors.map((item) => ({
        ...item,
        sourceKey: makeUniqueSourceKey(item.sourceKey, usedSourceKeys),
      })),
      ...skippedDropInItems(normalization.skipped, usedSourceKeys),
      ...(health.isCompleteSnapshot
        ? await processCandidates({
            db,
            scheduleSourceId: scheduleSource.id,
            seenAt,
            candidates: normalization.candidates,
            duplicateSourceOccurrenceIds,
            locationsById: locationIndex.locationsById,
            existingRunsByExternalId,
            usedSourceKeys,
          })
        : [
            {
              sourceKey: makeUniqueSourceKey("source-health", usedSourceKeys),
              action: ImportItemAction.ERROR,
              reviewStatus: ImportReviewStatus.PENDING,
              normalizedPayload: {
                issues: toCanonicalJsonValue(health.issues),
              },
              errorMessage: health.issues
                .map((issue) => issue.message)
                .join(" | "),
            },
          ]),
    ];
    const itemCounts = summarizeImportItems(items);
    const completedAt = new Date(now);
    const status = determineBatchStatus(health, itemCounts);

    await createImportItems(db, batch.id, items);

    const updatedBatch = await db.importBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        isCompleteSnapshot: health.isCompleteSnapshot,
        dropInResourceId: snapshot.dropInResource.id,
        locationsResourceId: snapshot.locationsResource.id,
        facilitiesResourceId: snapshot.facilitiesResource.id,
        dropInResourceLastModifiedAt: resourceModifiedAt(snapshot.dropInResource),
        locationsResourceLastModifiedAt: resourceModifiedAt(
          snapshot.locationsResource,
        ),
        facilitiesResourceLastModifiedAt: resourceModifiedAt(
          snapshot.facilitiesResource,
        ),
        snapshotHash,
        completedAt,
        dropInRecordCount: snapshot.dropInPage.records.length,
        locationsRecordCount: snapshot.locationsPage.records.length,
        facilitiesRecordCount: snapshot.facilitiesPage.records.length,
        basketballRecordCount:
          normalization.candidates.length +
          countBasketballRecords(normalization.skipped),
        createdCount: itemCounts.createdCount,
        updatedCount: itemCounts.updatedCount,
        unchangedCount: itemCounts.unchangedCount,
        skippedCount: itemCounts.skippedCount,
        errorCount: itemCounts.errorCount,
        errorSummary: errorSummary(health, items),
      },
      select: {
        id: true,
        scheduleSourceId: true,
        status: true,
        isCompleteSnapshot: true,
        snapshotHash: true,
        startedAt: true,
        completedAt: true,
        dropInRecordCount: true,
        locationsRecordCount: true,
        facilitiesRecordCount: true,
        basketballRecordCount: true,
        createdCount: true,
        updatedCount: true,
        unchangedCount: true,
        skippedCount: true,
        errorCount: true,
        dropInResourceId: true,
        locationsResourceId: true,
        facilitiesResourceId: true,
      },
    });

    return {
      batchId: updatedBatch.id,
      scheduleSourceId: updatedBatch.scheduleSourceId,
      status: updatedBatch.status,
      isCompleteSnapshot: updatedBatch.isCompleteSnapshot,
      snapshotHash: updatedBatch.snapshotHash,
      startedAt: updatedBatch.startedAt.toISOString(),
      completedAt: (updatedBatch.completedAt ?? completedAt).toISOString(),
      sourceHealth: health,
      duplicates,
      counts: {
        dropInRecordCount: updatedBatch.dropInRecordCount,
        locationsRecordCount: updatedBatch.locationsRecordCount,
        facilitiesRecordCount: updatedBatch.facilitiesRecordCount,
        basketballRecordCount: updatedBatch.basketballRecordCount,
        createdCount: updatedBatch.createdCount,
        updatedCount: updatedBatch.updatedCount,
        unchangedCount: updatedBatch.unchangedCount,
        skippedCount: updatedBatch.skippedCount,
        errorCount: updatedBatch.errorCount,
      },
      resources: {
        dropInResourceId: updatedBatch.dropInResourceId,
        locationsResourceId: updatedBatch.locationsResourceId,
        facilitiesResourceId: updatedBatch.facilitiesResourceId,
      },
    };
  } catch (error) {
    await failBatch(db, batch.id, new Date(now), error);
    throw error;
  }
}

export const TORONTO_DRY_RUN_IMPORT_SOURCE = {
  providerKey: TORONTO_DROP_IN_PROVIDER_KEY,
  sourceUrl: TORONTO_DROP_IN_SOURCE_URL,
  packageId: TORONTO_CKAN_PACKAGE_ID,
} as const;
