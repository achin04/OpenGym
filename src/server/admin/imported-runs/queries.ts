import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  ImportBatchMode,
  ImportItemAction,
  VenueMatchStatus,
} from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import {
  parseImportFieldDiffDisplay,
  parseImportItemPayloadDisplay,
  type ImportFieldDiffDisplay,
  type ImportItemPayloadDisplay,
} from "@/lib/admin/imported-runs/display-parsing";

type ImportedRunsQueryPrisma = Pick<
  PrismaClient,
  | "importBatch"
  | "importItem"
  | "externalVenueRef"
  | "importedVenueCreation"
  | "venue"
>;

const APPLY_TRIGGER_PREFIX = "apply:";

function applyTriggerForBatch(batchId: string) {
  return `${APPLY_TRIGGER_PREFIX}${batchId}`;
}

export type AdminImportBatchListItem = Awaited<
  ReturnType<typeof getAdminImportBatches>
>[number];

export type AdminImportBatchDetail = Awaited<
  ReturnType<typeof getAdminImportBatchDetail>
>;
export type AdminImportedVenueCreationListItem = Awaited<
  ReturnType<typeof getAdminImportedVenueCreations>
>[number];

export type AdminImportItemDisplay = {
  id: string;
  sourceKey: string;
  sourceOccurrenceId: string | null;
  sourceSeriesId: string | null;
  action: string;
  reviewStatus: string;
  runId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload: ImportItemPayloadDisplay | null;
  fieldDiffs: ImportFieldDiffDisplay[];
};

export type AdminPendingVenueGroup = {
  externalVenueRef: {
    id: string;
    externalId: string;
    sourceName: string;
    sourceAddressLine1: string | null;
    sourcePostalCode: string | null;
    sourceUrl: string | null;
    matchStatus: VenueMatchStatus;
    venueId: string | null;
  };
  itemCount: number;
  examples: AdminImportItemDisplay[];
};

export type AdminVenueOption = {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string | null;
};

function toImportItemDisplay(item: {
  id: string;
  sourceKey: string;
  sourceOccurrenceId: string | null;
  sourceSeriesId: string | null;
  action: string;
  reviewStatus: string;
  runId: string | null;
  normalizedPayload: unknown;
  fieldDiff: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminImportItemDisplay {
  return {
    id: item.id,
    sourceKey: item.sourceKey,
    sourceOccurrenceId: item.sourceOccurrenceId,
    sourceSeriesId: item.sourceSeriesId,
    action: item.action,
    reviewStatus: item.reviewStatus,
    runId: item.runId,
    errorMessage: item.errorMessage,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    payload: parseImportItemPayloadDisplay(item.normalizedPayload),
    fieldDiffs: parseImportFieldDiffDisplay(item.fieldDiff),
  };
}

function unresolvedExternalVenueRefIds(items: AdminImportItemDisplay[]) {
  return Array.from(
    new Set(
      items.flatMap((item) => {
        if (
          item.action !== ImportItemAction.SKIPPED ||
          item.payload?.venueMatchStatus !== VenueMatchStatus.PENDING ||
          !item.payload.externalVenueRefId
        ) {
          return [];
        }

        return [item.payload.externalVenueRefId];
      }),
    ),
  ).sort();
}

function groupPendingVenueItems({
  externalVenueRefs,
  items,
}: {
  externalVenueRefs: Awaited<
    ReturnType<typeof findExternalVenueRefsForDisplay>
  >;
  items: AdminImportItemDisplay[];
}): AdminPendingVenueGroup[] {
  const itemsByExternalVenueRefId = new Map<string, AdminImportItemDisplay[]>();

  for (const item of items) {
    const externalVenueRefId = item.payload?.externalVenueRefId;

    if (
      item.action !== ImportItemAction.SKIPPED ||
      item.payload?.venueMatchStatus !== VenueMatchStatus.PENDING ||
      !externalVenueRefId
    ) {
      continue;
    }

    const existing = itemsByExternalVenueRefId.get(externalVenueRefId) ?? [];
    existing.push(item);
    itemsByExternalVenueRefId.set(externalVenueRefId, existing);
  }

  return externalVenueRefs
    .flatMap((externalVenueRef) => {
      const groupItems = itemsByExternalVenueRefId.get(externalVenueRef.id) ?? [];

      if (groupItems.length === 0) {
        return [];
      }

      return [
        {
          externalVenueRef,
          itemCount: groupItems.length,
          examples: groupItems.slice(0, 5),
        },
      ];
    })
    .sort((left, right) =>
      left.externalVenueRef.sourceName.localeCompare(
        right.externalVenueRef.sourceName,
      ),
    );
}

async function findExternalVenueRefsForDisplay(
  db: ImportedRunsQueryPrisma,
  externalVenueRefIds: string[],
) {
  if (externalVenueRefIds.length === 0) {
    return [];
  }

  return db.externalVenueRef.findMany({
    where: {
      id: {
        in: externalVenueRefIds,
      },
    },
    select: {
      id: true,
      externalId: true,
      sourceName: true,
      sourceAddressLine1: true,
      sourcePostalCode: true,
      sourceUrl: true,
      matchStatus: true,
      venueId: true,
    },
    orderBy: {
      sourceName: "asc",
    },
  });
}

export async function getAdminImportBatches(
  db: ImportedRunsQueryPrisma = defaultPrisma,
) {
  return db.importBatch.findMany({
    take: 50,
    include: {
      scheduleSource: {
        select: {
          id: true,
          name: true,
          sourceType: true,
          providerKey: true,
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getAdminImportedVenueCreations(
  db: ImportedRunsQueryPrisma = defaultPrisma,
) {
  return db.importedVenueCreation.findMany({
    take: 100,
    include: {
      batch: {
        select: {
          id: true,
          startedAt: true,
          trigger: true,
          status: true,
          scheduleSource: {
            select: {
              id: true,
              name: true,
              sourceType: true,
              providerKey: true,
            },
          },
        },
      },
      externalVenueRef: {
        select: {
          id: true,
          externalId: true,
          venueId: true,
          sourceName: true,
          sourceAddressLine1: true,
          sourcePostalCode: true,
          sourceUrl: true,
          matchStatus: true,
        },
      },
      venue: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          websiteUrl: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAdminVenueOptions(
  db: ImportedRunsQueryPrisma = defaultPrisma,
): Promise<AdminVenueOption[]> {
  return db.venue.findMany({
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      postalCode: true,
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
}

export async function getAdminImportBatchDetail(
  batchId: string,
  db: ImportedRunsQueryPrisma = defaultPrisma,
) {
  const batch = await db.importBatch.findUnique({
    where: {
      id: batchId,
    },
    include: {
      scheduleSource: {
        select: {
          id: true,
          name: true,
          sourceType: true,
          providerKey: true,
          url: true,
        },
      },
      items: {
        orderBy: [{ action: "asc" }, { sourceKey: "asc" }],
      },
    },
  });

  if (!batch) {
    return null;
  }

  const appliedBatch =
    batch.mode === ImportBatchMode.DRY_RUN
      ? await db.importBatch.findFirst({
          where: {
            scheduleSourceId: batch.scheduleSourceId,
            mode: ImportBatchMode.APPLY,
            trigger: applyTriggerForBatch(batch.id),
          },
          select: {
            id: true,
            status: true,
            completedAt: true,
            createdCount: true,
            updatedCount: true,
            unchangedCount: true,
            skippedCount: true,
            errorCount: true,
          },
          orderBy: {
            startedAt: "asc",
          },
        })
      : null;

  const items = batch.items.map(toImportItemDisplay);
  const externalVenueRefs = await findExternalVenueRefsForDisplay(
    db,
    unresolvedExternalVenueRefIds(items),
  );

  return {
    batch,
    appliedBatch,
    items,
    itemGroups: {
      create: items.filter((item) => item.action === ImportItemAction.CREATE),
      update: items.filter((item) => item.action === ImportItemAction.UPDATE),
      unchanged: items.filter(
        (item) => item.action === ImportItemAction.UNCHANGED,
      ),
      skipped: items.filter((item) => item.action === ImportItemAction.SKIPPED),
      error: items.filter((item) => item.action === ImportItemAction.ERROR),
    },
    pendingVenueGroups: groupPendingVenueItems({
      externalVenueRefs,
      items,
    }),
  };
}
