import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import type {
  CreateVenueFromExternalRefInput,
  LinkExternalVenueRefInput,
} from "@/lib/admin/imported-runs/action-validation";
import {
  normalizeVenueDuplicatePostalCode,
  normalizeVenueDuplicateText,
} from "@/lib/admin/imported-runs/venue-normalization";

const TORONTO_DROP_IN_PROVIDER_KEY = "toronto-drop-in";
const TORONTO_DROP_IN_SOURCE_URL =
  "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";

type VenueResolutionPrisma = Pick<
  PrismaClient,
  "$transaction" | "externalVenueRef" | "venue"
>;

type VenueResolutionTransaction = Pick<
  PrismaClient,
  "externalVenueRef" | "venue"
>;

type TorontoExternalVenueRef = {
  id: string;
  venueId: string | null;
  sourceName: string;
  sourceAddressLine1: string | null;
  sourcePostalCode: string | null;
  sourceUrl: string | null;
  matchStatus: VenueMatchStatus;
  scheduleSource: {
    providerKey: string | null;
    url: string;
  };
};

type DuplicateVenueCandidate = {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  postalCode: string | null;
};

export type VenueResolutionResult = {
  externalVenueRefId: string;
  venueId: string;
};

export class VenueResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VenueResolutionError";
  }
}

function fail(message: string): never {
  throw new VenueResolutionError(message);
}

function isTorontoDropInSource(ref: TorontoExternalVenueRef) {
  return (
    ref.scheduleSource.providerKey === TORONTO_DROP_IN_PROVIDER_KEY ||
    ref.scheduleSource.url === TORONTO_DROP_IN_SOURCE_URL
  );
}

function assertResolvableTorontoRef(ref: TorontoExternalVenueRef) {
  if (!isTorontoDropInSource(ref)) {
    fail("External venue reference does not belong to the Toronto source.");
  }

  if (ref.venueId) {
    fail("This source location is already linked to a Venue.");
  }

  if (ref.matchStatus !== VenueMatchStatus.PENDING) {
    fail("Only pending source locations can be resolved.");
  }
}

async function findExternalVenueRef(
  db: VenueResolutionTransaction,
  externalVenueRefId: string,
) {
  return db.externalVenueRef.findUnique({
    where: {
      id: externalVenueRefId,
    },
    select: {
      id: true,
      venueId: true,
      sourceName: true,
      sourceAddressLine1: true,
      sourcePostalCode: true,
      sourceUrl: true,
      matchStatus: true,
      scheduleSource: {
        select: {
          providerKey: true,
          url: true,
        },
      },
    },
  });
}

function likelyDuplicateVenue(
  input: Pick<CreateVenueFromExternalRefInput, "name" | "addressLine1" | "city"> & {
    postalCode?: string | null;
  },
  venue: DuplicateVenueCandidate,
) {
  const inputCity = normalizeVenueDuplicateText(input.city);
  const venueCity = normalizeVenueDuplicateText(venue.city);

  if (!inputCity || inputCity !== venueCity) {
    return false;
  }

  const inputPostalCode = normalizeVenueDuplicatePostalCode(input.postalCode);
  const venuePostalCode = normalizeVenueDuplicatePostalCode(venue.postalCode);
  const postalCodesMatch =
    inputPostalCode !== null && inputPostalCode === venuePostalCode;

  if (!postalCodesMatch) {
    return false;
  }

  return (
    normalizeVenueDuplicateText(input.name) ===
      normalizeVenueDuplicateText(venue.name) ||
    normalizeVenueDuplicateText(input.addressLine1) ===
      normalizeVenueDuplicateText(venue.addressLine1)
  );
}

async function findLikelyDuplicateVenue(
  db: VenueResolutionTransaction,
  input: CreateVenueFromExternalRefInput,
) {
  const venues = await db.venue.findMany({
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      postalCode: true,
    },
  });

  return (
    venues.find((venue) => {
      return likelyDuplicateVenue(input, venue);
    }) ?? null
  );
}

export async function linkExternalVenueRefToVenue(
  input: LinkExternalVenueRefInput,
  db: VenueResolutionPrisma = defaultPrisma,
): Promise<VenueResolutionResult> {
  return db.$transaction(async (tx) => {
    const externalVenueRef = await findExternalVenueRef(
      tx,
      input.externalVenueRefId,
    );

    if (!externalVenueRef) {
      fail("External venue reference was not found.");
    }

    assertResolvableTorontoRef(externalVenueRef);

    const venue = await tx.venue.findUnique({
      where: {
        id: input.venueId,
      },
      select: {
        id: true,
      },
    });

    if (!venue) {
      fail("Selected Venue was not found.");
    }

    const updatedRef = await tx.externalVenueRef.update({
      where: {
        id: externalVenueRef.id,
      },
      data: {
        venueId: venue.id,
        matchStatus: VenueMatchStatus.MATCHED,
      },
      select: {
        id: true,
        venueId: true,
      },
    });

    return {
      externalVenueRefId: updatedRef.id,
      venueId: updatedRef.venueId ?? venue.id,
    };
  });
}

export async function createVenueFromExternalVenueRef(
  input: CreateVenueFromExternalRefInput,
  db: VenueResolutionPrisma = defaultPrisma,
): Promise<VenueResolutionResult> {
  return db.$transaction(async (tx) => {
    const externalVenueRef = await findExternalVenueRef(
      tx,
      input.externalVenueRefId,
    );

    if (!externalVenueRef) {
      fail("External venue reference was not found.");
    }

    assertResolvableTorontoRef(externalVenueRef);

    const duplicateVenue = await findLikelyDuplicateVenue(tx, input);

    if (duplicateVenue) {
      fail("A likely duplicate Venue already exists. Link that Venue instead.");
    }

    const venue = await tx.venue.create({
      data: {
        name: input.name,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 || null,
        city: input.city,
        postalCode: input.postalCode || null,
        websiteUrl: input.websiteUrl || externalVenueRef.sourceUrl || null,
        phone: input.phone || null,
      },
      select: {
        id: true,
      },
    });

    const updatedRef = await tx.externalVenueRef.update({
      where: {
        id: externalVenueRef.id,
      },
      data: {
        venueId: venue.id,
        matchStatus: VenueMatchStatus.MATCHED,
      },
      select: {
        id: true,
        venueId: true,
      },
    });

    return {
      externalVenueRefId: updatedRef.id,
      venueId: updatedRef.venueId ?? venue.id,
    };
  });
}
