import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { formatLabel } from "@/lib/formatters";
import { createImportedRun } from "./actions";
import { raisedButtonClass } from "@/app/_components/raised-button";

export default async function NewImportedRunPage() {
  await requireAdmin();

  const venues = await prisma.venue.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const scheduleSources = await prisma.scheduleSource.findMany({
    orderBy: [{ sourceType: "asc" }, { name: "asc" }],
  });

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
            Admin
          </p>
          <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
            New Imported Run
          </h1>
          <p className="max-w-2xl text-foreground/70">
            Manually add a verified run from an official city or university
            schedule.
          </p>
        </div>

        <form
          action={createImportedRun}
          className="grid gap-6 rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]"
        >
          <input
            name="title"
            required
            placeholder="Title"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />

          <select
            name="venueId"
            required
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
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
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
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
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="startTime"
              type="datetime-local"
              required
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
            <input
              name="endTime"
              type="datetime-local"
              required
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <textarea
            name="description"
            rows={4}
            placeholder="Description"
            className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Price"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
            <input
              name="maxPlayers"
              type="number"
              min="1"
              step="1"
              placeholder="Max players"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <select
              name="skillLevel"
              defaultValue="OPEN"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            >
              <option value="OPEN">Open</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>

            <select
              name="ageGroup"
              defaultValue="ADULT"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            >
              <option value="ADULT">Adult</option>
              <option value="ALL_AGES">All ages</option>
              <option value="YOUTH">Youth</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>

          <button
            type="submit"
            className={`w-fit ${raisedButtonClass({ variant: "solid" })}`}
          >
            Create imported run
          </button>
        </form>
      </section>
    </main>
  );
}
