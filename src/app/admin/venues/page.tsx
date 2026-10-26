import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { createVenue } from "./actions";
import { raisedButtonClass } from "@/app/_components/raised-button";
import { GeocodeMissingButton } from "./_components/geocode-missing-button";
import { VenueCoordinatesControls } from "./_components/venue-coordinates-controls";

/*
 * Geocoding a batch is paced by Nominatim at one request per second, so the
 * action needs more than the platform's default few seconds. 60s is the
 * ceiling on Vercel's lower plans and comfortably covers a 15-venue batch.
 */
export const maxDuration = 60;

export default async function AdminVenuesPage() {
  await requireAdmin();

  const venues = await prisma.venue.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const missingCoordinatesCount = venues.filter(
    (venue) => venue.latitude === null || venue.longitude === null,
  ).length;

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
            Admin
          </p>

          <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">Venues</h1>

          <p className="max-w-2xl text-foreground/70">
            Add indoor basketball locations that runs can be attached to.
          </p>

          {/*
            Stated up front rather than left to be discovered card by card: a
            venue without coordinates is invisible on the home map and nothing
            else in the product reports that.
          */}
          <p className="max-w-2xl text-sm font-semibold text-foreground/75">
            {missingCoordinatesCount === 0
              ? `All ${venues.length} venues have coordinates and can appear on the map.`
              : `${missingCoordinatesCount} of ${venues.length} venues have no coordinates and will not appear on the map.`}
          </p>

          <GeocodeMissingButton missingCount={missingCoordinatesCount} />
        </div>

        <form
          action={createVenue}
          className="grid gap-6 rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]"
        >
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-semibold text-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="addressLine1"
              className="text-sm font-semibold text-foreground"
            >
              Address
            </label>
            <input
              id="addressLine1"
              name="addressLine1"
              required
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="addressLine2"
              className="text-sm font-semibold text-foreground"
            >
              Address 2
            </label>
            <input
              id="addressLine2"
              name="addressLine2"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <input
              name="city"
              required
              placeholder="City"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
            <input
              name="postalCode"
              placeholder="Postal code"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
            <input
              name="phone"
              placeholder="Phone"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <input
            name="websiteUrl"
            type="url"
            placeholder="Website URL"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />

          <button
            type="submit"
            className={`w-fit ${raisedButtonClass({ variant: "solid" })}`}
          >
            Create venue
          </button>
        </form>

        <div className="grid gap-4">
          {venues.map((venue) => (
            <article
              key={venue.id}
              className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]"
            >
              <h2 className="text-xl font-semibold">{venue.name}</h2>
              <p className="mt-2 text-foreground/70">
                {venue.addressLine1}, {venue.city}
              </p>

              <VenueCoordinatesControls
                venue={{
                  id: venue.id,
                  latitude: venue.latitude,
                  longitude: venue.longitude,
                  geocodedAt: venue.geocodedAt,
                  geocodeSource: venue.geocodeSource,
                }}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
