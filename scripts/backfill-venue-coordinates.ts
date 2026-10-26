import "dotenv/config";
import { prisma } from "@/server/db";
import { buildVenueGeoQuery } from "@/lib/geocoding/venue-geo-query";
import { geocodeVenueById } from "@/server/geocoding/venue-coordinates";

/**
 * Fills in coordinates for venues that have none.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npm run backfill:venue-coordinates            # list what would be geocoded
 *   npm run backfill:venue-coordinates -- --apply # geocode and save
 *
 * Idempotent on purpose: it only ever selects venues whose latitude is null,
 * so re-running after a partial failure picks up exactly the stragglers and
 * can never overwrite a coordinate an admin corrected by hand.
 *
 * Nominatim's one-request-per-second policy is enforced inside the geocoding
 * client, so this loop is deliberately sequential -- roughly a second per
 * venue. A Promise.all here would fire every request at once and breach the
 * policy no matter what the client did.
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const venues = await prisma.venue.findMany({
    where: { latitude: null },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
      postalCode: true,
    },
  });

  console.log(
    `${venues.length} venue(s) without coordinates${apply ? "" : " (dry run)"}`,
  );

  if (venues.length === 0) {
    return;
  }

  if (!apply) {
    for (const venue of venues) {
      console.log(
        `  would geocode: ${venue.name} -> "${buildVenueGeoQuery(venue)}"`,
      );
    }

    console.log(
      `\nRe-run with --apply to geocode these ${venues.length} venue(s). ` +
        `At one request per second this takes about ${Math.ceil(venues.length * 1.1)}s.`,
    );
    return;
  }

  const counts = { ok: 0, noMatch: 0, error: 0, skipped: 0 };

  for (const [index, venue] of venues.entries()) {
    const result = await geocodeVenueById(venue.id, { mode: "fillMissing" });
    const position = `[${index + 1}/${venues.length}]`;

    switch (result.status) {
      case "ok":
        counts.ok += 1;
        console.log(
          `${position} ok        ${venue.name} -> ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`,
        );
        break;
      case "no_match":
        counts.noMatch += 1;
        console.warn(`${position} no match  ${venue.name}: ${result.reason}`);
        break;
      case "skipped":
        counts.skipped += 1;
        console.log(`${position} skipped   ${venue.name}: ${result.reason}`);
        break;
      case "error":
        counts.error += 1;
        console.error(`${position} error     ${venue.name}: ${result.reason}`);
        break;
    }
  }

  console.log(
    `\nDone. ${counts.ok} geocoded, ${counts.noMatch} without a match, ` +
      `${counts.skipped} skipped, ${counts.error} errored.`,
  );

  // Anything left unresolved is listed in Admin -> Venues with a "No
  // coordinates" badge, so the remainder is visible rather than lost here in
  // scrollback.
  if (counts.noMatch > 0 || counts.error > 0) {
    console.log(
      "Unresolved venues are flagged in Admin -> Venues and can be fixed by hand there.",
    );
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
