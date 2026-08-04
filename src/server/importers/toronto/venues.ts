import type { PrismaClient } from "@/generated/prisma/client";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import { likelyDuplicateVenue } from "@/lib/admin/imported-runs/venue-normalization";
import { prisma as defaultPrisma } from "@/server/db";
import {
  matchTorontoVenue,
  type NormalizedTorontoLocation,
  type TorontoVenueMatchCandidate,
  type TorontoVenueMatchResult,
} from "./normalization";

type TorontoVenueRefPrisma = Pick<PrismaClient, "externalVenueRef" | "venue">;
type TorontoVenueAutoCreatePrisma = Pick<
  PrismaClient,
  "$transaction" | "externalVenueRef" | "importedVenueCreation" | "venue"
>;
type TorontoVenueAutoCreateTransaction = Pick<
  PrismaClient,
  "externalVenueRef" | "importedVenueCreation" | "venue"
>;

const externalVenueRefSelect = {
  id: true,
  scheduleSourceId: true,
  externalId: true,
  venueId: true,
  sourceName: true,
  sourceAddressLine1: true,
  sourcePostalCode: true,
  sourceUrl: true,
  matchStatus: true,
  firstSeenAt: true,
  lastSeenAt: true,
} as const;

const createdVenueSelect = {
  id: true,
  name: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  postalCode: true,
  websiteUrl: true,
  phone: true,
} as const;

const importedVenueCreationSelect = {
  id: true,
  batchId: true,
  externalVenueRefId: true,
  venueId: true,
  sourceName: true,
  sourceAddressLine1: true,
  sourcePostalCode: true,
  sourceUrl: true,
  removedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TorontoExternalVenueRefRecord = {
  id: string;
  scheduleSourceId: string;
  externalId: string;
  venueId: string | null;
  sourceName: string;
  sourceAddressLine1: string | null;
  sourcePostalCode: string | null;
  sourceUrl: string | null;
  matchStatus: VenueMatchStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export type TorontoCreatedVenueRecord = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string | null;
  websiteUrl: string | null;
  phone: string | null;
};

export type TorontoImportedVenueCreationRecord = {
  id: string;
  batchId: string;
  externalVenueRefId: string;
  venueId: string | null;
  sourceName: string;
  sourceAddressLine1: string | null;
  sourcePostalCode: string | null;
  sourceUrl: string | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TorontoExternalVenueRefResult =
  | {
      status: typeof VenueMatchStatus.MATCHED;
      venueId: string;
      reason: "existing_external_ref" | "exact_name_address";
      externalVenueRef: TorontoExternalVenueRefRecord;
      matchResult?: Extract<
        TorontoVenueMatchResult,
        { status: typeof VenueMatchStatus.MATCHED }
      >;
    }
  | {
      status: typeof VenueMatchStatus.PENDING;
      venueId: null;
      reason:
        | "missing_source_address"
        | "no_exact_match"
        | "multiple_exact_matches";
      externalVenueRef: TorontoExternalVenueRefRecord;
      matchResult: Extract<
        TorontoVenueMatchResult,
        { status: typeof VenueMatchStatus.PENDING }
      >;
    };

export type FindOrCreateTorontoExternalVenueRefOptions = {
  scheduleSourceId: string;
  location: NormalizedTorontoLocation;
  seenAt?: Date;
  db?: TorontoVenueRefPrisma;
};

export type CreateTorontoVenueFromLocationOptions = {
  batchId: string;
  scheduleSourceId: string;
  location: NormalizedTorontoLocation;
  seenAt?: Date;
  db?: TorontoVenueAutoCreatePrisma;
};

export type ResolveTorontoExternalVenueRefOptions = {
  batchId: string;
  scheduleSourceId: string;
  location: NormalizedTorontoLocation;
  seenAt?: Date;
  db?: TorontoVenueAutoCreatePrisma;
};

export type TorontoVenueAutoCreateDecision =
  | {
      eligible: true;
      reason: "no_exact_match";
      matchResult: Extract<
        TorontoVenueMatchResult,
        { status: typeof VenueMatchStatus.PENDING }
      >;
    }
  | {
      eligible: false;
      reason:
        | "already_matched"
        | "missing_source_address"
        | "multiple_exact_matches"
        | "likely_duplicate_venue";
      matchResult: TorontoVenueMatchResult;
      duplicateVenue?: TorontoVenueMatchCandidate;
    };

export type TorontoVenueAutoCreateResult = {
  status: typeof VenueMatchStatus.MATCHED;
  venueId: string;
  reason: "auto_created_from_source";
  externalVenueRef: TorontoExternalVenueRefRecord;
  venue: TorontoCreatedVenueRecord;
  importedVenueCreation: TorontoImportedVenueCreationRecord;
};

export type TorontoExternalVenueRefPendingResult = {
  status: typeof VenueMatchStatus.PENDING;
  venueId: null;
  reason:
    | "missing_source_address"
    | "no_exact_match"
    | "multiple_exact_matches"
    | "likely_duplicate_venue";
  externalVenueRef: TorontoExternalVenueRefRecord;
  matchResult: Extract<
    TorontoVenueMatchResult,
    { status: typeof VenueMatchStatus.PENDING }
  >;
  duplicateVenue?: TorontoVenueMatchCandidate;
};

export type TorontoExternalVenueRefIgnoredResult = {
  status: typeof VenueMatchStatus.IGNORED;
  venueId: null;
  reason: "ignored_external_ref";
  externalVenueRef: TorontoExternalVenueRefRecord;
};

export type ResolveTorontoExternalVenueRefResult =
  | Extract<TorontoExternalVenueRefResult, { status: typeof VenueMatchStatus.MATCHED }>
  | TorontoVenueAutoCreateResult
  | TorontoExternalVenueRefPendingResult
  | TorontoExternalVenueRefIgnoredResult;

export class TorontoVenueAutoCreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TorontoVenueAutoCreateError";
  }
}

function failAutoCreate(message: string): never {
  throw new TorontoVenueAutoCreateError(message);
}

function sourceReferenceData(
  location: NormalizedTorontoLocation,
  seenAt: Date,
) {
  return {
    sourceName: location.sourceName,
    sourceAddressLine1: location.sourceAddressLine1,
    sourcePostalCode: location.sourcePostalCode,
    sourceUrl: location.sourceUrl,
    lastSeenAt: seenAt,
  };
}

function assertAutoCreateEligible(
  decision: TorontoVenueAutoCreateDecision,
): asserts decision is Extract<TorontoVenueAutoCreateDecision, { eligible: true }> {
  if (!decision.eligible) {
    failAutoCreate(
      `Toronto source location is not eligible for automatic venue creation: ${decision.reason}.`,
    );
  }
}

function venueDataFromLocation(location: NormalizedTorontoLocation) {
  if (!location.sourceAddressLine1) {
    failAutoCreate(
      "Toronto source location is not eligible for automatic venue creation: missing_source_address.",
    );
  }

  return {
    name: location.sourceName,
    addressLine1: location.sourceAddressLine1,
    city: "Toronto",
    postalCode: location.sourcePostalCode,
    websiteUrl: location.sourceUrl,
  };
}

async function findExistingExternalVenueRef(
  db: TorontoVenueRefPrisma,
  scheduleSourceId: string,
  externalId: string,
): Promise<TorontoExternalVenueRefRecord | null> {
  return db.externalVenueRef.findUnique({
    where: {
      scheduleSourceId_externalId: {
        scheduleSourceId,
        externalId,
      },
    },
    select: externalVenueRefSelect,
  });
}

async function findVenueMatchCandidates(
  db: TorontoVenueRefPrisma,
): Promise<TorontoVenueMatchCandidate[]> {
  return db.venue.findMany({
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      postalCode: true,
    },
  });
}

async function upsertExternalVenueRefForMatch({
  db,
  existingExternalVenueRef,
  scheduleSourceId,
  location,
  seenAt,
  venueId,
  matchStatus,
}: {
  db: TorontoVenueRefPrisma;
  existingExternalVenueRef: TorontoExternalVenueRefRecord | null;
  scheduleSourceId: string;
  location: NormalizedTorontoLocation;
  seenAt: Date;
  venueId: string | null;
  matchStatus: VenueMatchStatus;
}): Promise<TorontoExternalVenueRefRecord> {
  const refData = {
    ...sourceReferenceData(location, seenAt),
    venueId,
    matchStatus,
  };

  return existingExternalVenueRef
    ? db.externalVenueRef.update({
        where: {
          id: existingExternalVenueRef.id,
        },
        data: refData,
        select: externalVenueRefSelect,
      })
    : db.externalVenueRef.create({
        data: {
          scheduleSourceId,
          externalId: location.sourceLocationId,
          ...refData,
          firstSeenAt: seenAt,
        },
        select: externalVenueRefSelect,
      });
}

export function evaluateTorontoVenueAutoCreateEligibility(
  location: NormalizedTorontoLocation,
  venues: TorontoVenueMatchCandidate[],
): TorontoVenueAutoCreateDecision {
  const matchResult = matchTorontoVenue(location, venues);

  if (matchResult.status === VenueMatchStatus.MATCHED) {
    return {
      eligible: false,
      reason: "already_matched",
      matchResult,
    };
  }

  if (matchResult.reason !== "no_exact_match") {
    return {
      eligible: false,
      reason: matchResult.reason,
      matchResult,
    };
  }

  const sourceAddressLine1 = location.sourceAddressLine1;

  if (!sourceAddressLine1) {
    return {
      eligible: false,
      reason: "missing_source_address",
      matchResult,
    };
  }

  const duplicateVenue = venues.find((venue) =>
    likelyDuplicateVenue(
      {
        name: location.sourceName,
        addressLine1: sourceAddressLine1,
        city: "Toronto",
        postalCode: location.sourcePostalCode,
      },
      venue,
    ),
  );

  if (duplicateVenue) {
    return {
      eligible: false,
      reason: "likely_duplicate_venue",
      matchResult,
      duplicateVenue,
    };
  }

  return {
    eligible: true,
    reason: "no_exact_match",
    matchResult,
  };
}

export async function createTorontoVenueFromLocation({
  batchId,
  scheduleSourceId,
  location,
  seenAt = new Date(),
  db = defaultPrisma,
}: CreateTorontoVenueFromLocationOptions): Promise<TorontoVenueAutoCreateResult> {
  return db.$transaction(async (tx: TorontoVenueAutoCreateTransaction) => {
    const existingExternalVenueRef = await findExistingExternalVenueRef(
      tx,
      scheduleSourceId,
      location.sourceLocationId,
    );

    if (existingExternalVenueRef?.venueId) {
      failAutoCreate("Toronto source location is already linked to a Venue.");
    }

    if (
      existingExternalVenueRef &&
      existingExternalVenueRef.matchStatus !== VenueMatchStatus.PENDING
    ) {
      failAutoCreate("Only pending Toronto source locations can be auto-created.");
    }

    const decision = evaluateTorontoVenueAutoCreateEligibility(
      location,
      await findVenueMatchCandidates(tx),
    );
    assertAutoCreateEligible(decision);

    const venue = await tx.venue.create({
      data: venueDataFromLocation(location),
      select: createdVenueSelect,
    });
    const externalVenueRef = await upsertExternalVenueRefForMatch({
      db: tx,
      existingExternalVenueRef,
      scheduleSourceId,
      location,
      seenAt,
      venueId: venue.id,
      matchStatus: VenueMatchStatus.MATCHED,
    });
    const importedVenueCreation = await tx.importedVenueCreation.create({
      data: {
        batchId,
        externalVenueRefId: externalVenueRef.id,
        venueId: venue.id,
        sourceName: location.sourceName,
        sourceAddressLine1: location.sourceAddressLine1,
        sourcePostalCode: location.sourcePostalCode,
        sourceUrl: location.sourceUrl,
      },
      select: importedVenueCreationSelect,
    });

    return {
      status: VenueMatchStatus.MATCHED,
      venueId: venue.id,
      reason: "auto_created_from_source",
      externalVenueRef,
      venue,
      importedVenueCreation,
    } satisfies TorontoVenueAutoCreateResult;
  });
}

export async function resolveTorontoExternalVenueRef({
  batchId,
  scheduleSourceId,
  location,
  seenAt = new Date(),
  db = defaultPrisma,
}: ResolveTorontoExternalVenueRefOptions): Promise<ResolveTorontoExternalVenueRefResult> {
  const existingExternalVenueRef = await findExistingExternalVenueRef(
    db,
    scheduleSourceId,
    location.sourceLocationId,
  );

  if (existingExternalVenueRef?.venueId) {
    const externalVenueRef = await db.externalVenueRef.update({
      where: {
        id: existingExternalVenueRef.id,
      },
      data: {
        ...sourceReferenceData(location, seenAt),
        matchStatus: VenueMatchStatus.MATCHED,
      },
      select: externalVenueRefSelect,
    });

    return {
      status: VenueMatchStatus.MATCHED,
      venueId: existingExternalVenueRef.venueId,
      reason: "existing_external_ref",
      externalVenueRef,
    };
  }

  if (existingExternalVenueRef?.matchStatus === VenueMatchStatus.IGNORED) {
    const externalVenueRef = await db.externalVenueRef.update({
      where: {
        id: existingExternalVenueRef.id,
      },
      data: {
        ...sourceReferenceData(location, seenAt),
        venueId: null,
        matchStatus: VenueMatchStatus.IGNORED,
      },
      select: externalVenueRefSelect,
    });

    return {
      status: VenueMatchStatus.IGNORED,
      venueId: null,
      reason: "ignored_external_ref",
      externalVenueRef,
    };
  }

  const venues = await findVenueMatchCandidates(db);
  const matchResult = matchTorontoVenue(location, venues);

  if (matchResult.status === VenueMatchStatus.MATCHED) {
    const externalVenueRef = await upsertExternalVenueRefForMatch({
      db,
      existingExternalVenueRef,
      scheduleSourceId,
      location,
      seenAt,
      venueId: matchResult.venueId,
      matchStatus: VenueMatchStatus.MATCHED,
    });

    return {
      status: VenueMatchStatus.MATCHED,
      venueId: matchResult.venueId,
      reason: matchResult.reason,
      externalVenueRef,
      matchResult,
    };
  }

  const autoCreateDecision = evaluateTorontoVenueAutoCreateEligibility(
    location,
    venues,
  );

  if (autoCreateDecision.eligible) {
    return createTorontoVenueFromLocation({
      batchId,
      scheduleSourceId,
      location,
      seenAt,
      db,
    });
  }

  if (autoCreateDecision.reason === "already_matched") {
    failAutoCreate("Toronto source location became matched during resolution.");
  }

  const externalVenueRef = await upsertExternalVenueRefForMatch({
    db,
    existingExternalVenueRef,
    scheduleSourceId,
    location,
    seenAt,
    venueId: null,
    matchStatus: VenueMatchStatus.PENDING,
  });

  return {
    status: VenueMatchStatus.PENDING,
    venueId: null,
    reason: autoCreateDecision.reason,
    externalVenueRef,
    matchResult,
    duplicateVenue: autoCreateDecision.duplicateVenue,
  };
}

export async function findOrCreateTorontoExternalVenueRef({
  scheduleSourceId,
  location,
  seenAt = new Date(),
  db = defaultPrisma,
}: FindOrCreateTorontoExternalVenueRefOptions): Promise<TorontoExternalVenueRefResult> {
  const externalId = location.sourceLocationId;
  const existingExternalVenueRef = await findExistingExternalVenueRef(
    db,
    scheduleSourceId,
    externalId,
  );

  if (existingExternalVenueRef?.venueId) {
    const externalVenueRef = await db.externalVenueRef.update({
      where: {
        id: existingExternalVenueRef.id,
      },
      data: {
        ...sourceReferenceData(location, seenAt),
        matchStatus: VenueMatchStatus.MATCHED,
      },
      select: externalVenueRefSelect,
    });

    return {
      status: VenueMatchStatus.MATCHED,
      venueId: existingExternalVenueRef.venueId,
      reason: "existing_external_ref",
      externalVenueRef,
    };
  }

  const matchResult = matchTorontoVenue(
    location,
    await findVenueMatchCandidates(db),
  );
  const matchedVenueId =
    matchResult.status === VenueMatchStatus.MATCHED ? matchResult.venueId : null;

  const externalVenueRef = await upsertExternalVenueRefForMatch({
    db,
    existingExternalVenueRef,
    scheduleSourceId,
    location,
    seenAt,
    venueId: matchedVenueId,
    matchStatus: matchResult.status,
  });

  if (matchResult.status === VenueMatchStatus.MATCHED) {
    return {
      status: VenueMatchStatus.MATCHED,
      venueId: matchResult.venueId,
      reason: matchResult.reason,
      externalVenueRef,
      matchResult,
    };
  }

  return {
    status: VenueMatchStatus.PENDING,
    venueId: null,
    reason: matchResult.reason,
    externalVenueRef,
    matchResult,
  };
}
