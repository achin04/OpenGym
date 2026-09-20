import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { formatLabel } from "@/lib/formatters";
import { createImportedRun } from "./actions";

export default async function NewImportedRunPage() {
  await requireAdmin();

  const venues = await prisma.venue.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const scheduleSources = await prisma.scheduleSource.findMany({
    orderBy: [{ sourceType: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Admin
          </p>
          <h1 className="text-4xl font-semibold tracking-normal">
            New Imported Run
          </h1>
          <p className="max-w-2xl text-zinc-600">
            Manually add a verified run from an official city or university
            schedule.
          </p>
        </div>

        <form
          action={createImportedRun}
          className="grid gap-6 rounded-lg border border-foreground/10 bg-foreground/5 p-6"
        >
          <input
            name="title"
            required
            placeholder="Title"
            className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
          />

          <select
            name="venueId"
            required
            className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
          >
            <option value="">Select a venue</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.city}
              </option>
            ))}
          </select>

          <select
            name="scheduleSourceId"
            required
            className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
          >
            <option value="">Select a schedule source</option>
            {scheduleSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} · {formatLabel(source.sourceType)}
              </option>
            ))}
          </select>

          <input
            name="sourceUrl"
            type="url"
            required
            placeholder="Exact source URL"
            className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="startTime"
              type="datetime-local"
              required
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
            <input
              name="endTime"
              type="datetime-local"
              required
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
          </div>

          <textarea
            name="description"
            rows={4}
            placeholder="Description"
            className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Price"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
            <input
              name="maxPlayers"
              type="number"
              min="1"
              step="1"
              placeholder="Max players"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <select
              name="skillLevel"
              defaultValue="OPEN"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            >
              <option value="OPEN">Open</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>

            <select
              name="ageGroup"
              defaultValue="ADULT"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            >
              <option value="ADULT">Adult</option>
              <option value="ALL_AGES">All ages</option>
              <option value="YOUTH">Youth</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            Create imported run
          </button>
        </form>
      </section>
    </main>
  );
}
