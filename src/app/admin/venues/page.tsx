import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { createVenue } from "./actions";

export default async function AdminVenuesPage() {
  await requireAdmin();

  const venues = await prisma.venue.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Admin
          </p>

          <h1 className="text-4xl font-semibold tracking-normal">Venues</h1>

          <p className="max-w-2xl text-zinc-300">
            Add indoor basketball locations that runs can be attached to.
          </p>
        </div>

        <form
          action={createVenue}
          className="grid gap-6 rounded-lg border border-white/10 bg-white/5 p-6"
        >
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-100">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="addressLine1"
              className="text-sm font-medium text-zinc-100"
            >
              Address
            </label>
            <input
              id="addressLine1"
              name="addressLine1"
              required
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="addressLine2"
              className="text-sm font-medium text-zinc-100"
            >
              Address 2
            </label>
            <input
              id="addressLine2"
              name="addressLine2"
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <input
              name="city"
              required
              placeholder="City"
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
            <input
              name="postalCode"
              placeholder="Postal code"
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
            <input
              name="phone"
              placeholder="Phone"
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
            />
          </div>

          <input
            name="websiteUrl"
            type="url"
            placeholder="Website URL"
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-white"
          />

          <button
            type="submit"
            className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            Create venue
          </button>
        </form>

        <div className="grid gap-4">
          {venues.map((venue) => (
            <article
              key={venue.id}
              className="rounded-lg border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-xl font-semibold">{venue.name}</h2>
              <p className="mt-2 text-zinc-300">
                {venue.addressLine1}, {venue.city}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
