import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { VenueMatchStatus } from "@/generated/prisma/enums";
import { prisma as defaultPrisma } from "@/server/db";
import type {
  CreateVenueFromExternalRefInput,
  LinkExternalVenueRefInput,
  RemoveImportedVenueCreationVenueInput,
  UpdateImportedVenueCreationVenueInput,
} from "@/lib/admin/imported-runs/action-validation";
import { likelyDuplicateVenue } from "@/lib/admin/imported-runs/venue-normalization";

const TORONTO_DROP_IN_PROVIDER_KEY = "toronto-drop-in";
const TORONTO_DROP_IN_SOURCE_URL =
  "https://open.toronto.ca/dataset/registered-programs-and-drop-in-courses-offering/";

type VenueResolutionPrisma = Pick<
  PrismaClient,
  "$transaction" | "externalVenueRef" | "importedVenueCreation" | "run" | "venue"
>;

type VenueResolutionTransaction = Pick<
  PrismaClient,
  "externalVenueRef" | "importedVenueCreation" | "run" | "venue"
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

export type VenueResolutionResult = {
  externalVenueRefId: string;
  venueId: string;
};

export type ImportedVenueCreationVenueUpdateResult = {
  importedVenueCreationId: string;
  venueId: string;
};

export type ImportedVenueCreationVenueRemoveResult = {
  importedVenueCreationId: string;
  externalVenueRefId: string;
  venueId: string;
  removedAt: Date;
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

async function findImportedVenueCreationForEdit(
  db: VenueResolutionTransaction,
  importedVenueCreationId: string,
) {
  return db.importedVenueCreation.findUnique({
    where: {
      id: importedVenueCreationId,
    },
    select: {
      id: true,
      externalVenueRefId: true,
      venueId: true,
      removedAt: true,
      externalVenueRef: {
        select: {
          id: true,
          venueId: true,
        },
      },
    },
  });
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

export async function updateImportedVenueCreationVenue(
  input: UpdateImportedVenueCreationVenueInput,
  db: VenueResolutionPrisma = defaultPrisma,
): Promise<ImportedVenueCreationVenueUpdateResult> {
  return db.$transaction(async (tx) => {
    const importedVenueCreation = await findImportedVenueCreationForEdit(
      tx,
      input.importedVenueCreationId,
    );

    if (!importedVenueCreation) {
      fail("Imported venue creation was not found.");
    }

    if (importedVenueCreation.removedAt || !importedVenueCreation.venueId) {
      fail("This imported venue has already been removed.");
    }

    if (importedVenueCreation.externalVenueRef.venueId !== importedVenueCreation.venueId) {
      fail("This imported venue is no longer linked to its source reference.");
    }

    const venue = await tx.venue.update({
      where: {
        id: importedVenueCreation.venueId,
      },
      data: {
        name: input.name,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 || null,
        city: input.city,
        postalCode: input.postalCode || null,
        websiteUrl: input.websiteUrl || null,
        phone: input.phone || null,
      },
      select: {
        id: true,
      },
    });

    return {
      importedVenueCreationId: importedVenueCreation.id,
      venueId: venue.id,
    };
  });
}

export async function removeImportedVenueCreationVenue(
  input: RemoveImportedVenueCreationVenueInput,
  db: VenueResolutionPrisma = defaultPrisma,
): Promise<ImportedVenueCreationVenueRemoveResult> {
  return db.$transaction(async (tx) => {
    const importedVenueCreation = await findImportedVenueCreationForEdit(
      tx,
      input.importedVenueCreationId,
    );

    if (!importedVenueCreation) {
      fail("Imported venue creation was not found.");
    }

    if (importedVenueCreation.removedAt || !importedVenueCreation.venueId) {
      fail("This imported venue has already been removed.");
    }

    if (importedVenueCreation.externalVenueRef.venueId !== importedVenueCreation.venueId) {
      fail("This imported venue is no longer linked to its source reference.");
    }

    const runCount = await tx.run.count({
      where: {
        venueId: importedVenueCreation.venueId,
      },
    });

    if (runCount > 0) {
      fail(
        "This Venue is used by existing runs. Edit it or reassign those runs before removing it.",
      );
    }

    const otherExternalRefCount = await tx.externalVenueRef.count({
      where: {
        venueId: importedVenueCreation.venueId,
        id: {
          not: importedVenueCreation.externalVenueRefId,
        },
      },
    });

    if (otherExternalRefCount > 0) {
      fail(
        "This Venue is linked to other source references. Edit it instead of removing it.",
      );
    }

    await tx.externalVenueRef.update({
      where: {
        id: importedVenueCreation.externalVenueRefId,
      },
      data: {
        venueId: null,
        matchStatus: VenueMatchStatus.IGNORED,
      },
    });

    const removedAt = new Date();
    await tx.importedVenueCreation.update({
      where: {
        id: importedVenueCreation.id,
      },
      data: {
        venueId: null,
        removedAt,
      },
    });

    await tx.venue.delete({
      where: {
        id: importedVenueCreation.venueId,
      },
    });

    return {
      importedVenueCreationId: importedVenueCreation.id,
      externalVenueRefId: importedVenueCreation.externalVenueRefId,
      venueId: importedVenueCreation.venueId,
      removedAt,
    };
  });
}
