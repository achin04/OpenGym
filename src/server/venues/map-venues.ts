import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { upcomingRunFilter } from "@/lib/runs/public-runs";
import type { MapVenue } from "@/lib/venues/map-venue";
import { prisma as defaultPrisma } from "@/server/db";

type MapVenuesPrisma = Pick<PrismaClient, "venue">;

// The pin payload is just enough for the pin and its popup: a name to show and
// an id to link with. No next-run time, no run count -- the popup shows a name
// and a "View runs" button, and a field the UI does not render is a field that
// has to be kept correct for nothing.
export type { MapVenue };

/**
 * Venues with coordinates and at least one upcoming run.
 *
 * Every pin is shipped in the initial page payload rather than fetched from a
 * bounding-box endpoint. At Toronto scale that is on the order of 20KB, and it
 * buys away a loading state, a round trip before the first pin, and a class of
 * race condition on pan. Revisit at a few thousand venues or a second city.
 */
export async function findMapVenues(
  now: Date,
  db: MapVenuesPrisma = defaultPrisma,
): Promise<MapVenue[]> {
  const venues = await db.venue.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      runs: {
        some: upcomingRunFilter(now),
      },
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
    },
    orderBy: { name: "asc" },
  });

  // Prisma still types these as nullable despite the `not: null` filter, so the
  // narrowing is done here rather than pushed onto the client component with a
  // non-null assertion. One guard at the boundary means the map never has to
  // consider a pin without a position.
  return venues.flatMap((venue) =>
    venue.latitude === null || venue.longitude === null
      ? []
      : [
          {
            id: venue.id,
            name: venue.name,
            latitude: venue.latitude,
            longitude: venue.longitude,
          },
        ],
  );
}
