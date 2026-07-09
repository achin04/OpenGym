import type { PrismaClient } from "@/generated/prisma/client";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import {
  matchTorontoVenue,
  type NormalizedTorontoLocation,
  type TorontoVenueMatchCandidate,
  type TorontoVenueMatchResult,
} from "./normalization";

type TorontoVenueRefPrisma = Pick<PrismaClient, "externalVenueRef" | "venue">;

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

  const externalVenueRef = existingExternalVenueRef
    ? await db.externalVenueRef.update({
        where: {
          id: existingExternalVenueRef.id,
        },
        data: {
          ...sourceReferenceData(location, seenAt),
          venueId: matchedVenueId,
          matchStatus: matchResult.status,
        },
        select: externalVenueRefSelect,
      })
    : await db.externalVenueRef.create({
        data: {
          scheduleSourceId,
          externalId,
          ...sourceReferenceData(location, seenAt),
          firstSeenAt: seenAt,
          venueId: matchedVenueId,
          matchStatus: matchResult.status,
        },
        select: externalVenueRefSelect,
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
