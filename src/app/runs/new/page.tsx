import { prisma } from "@/server/db";
import { createRun } from "./actions";

export default async function NewRunPage() {
  const venues = await prisma.venue.findMany({
    orderBy: [
      {
        city: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  return (
    <main className="min-h-screen px-5 py-8 text-cream sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
            Create Run
          </p>

          <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
            Add a basketball run
          </h1>

          <p className="max-w-2xl text-cream/62">
            Share an indoor basketball run with the OpenGym community.
          </p>
        </div>

        <form
          action={createRun}
          className="grid gap-6 rounded-lg border border-line bg-ink-900/72 p-5 text-cream/70 sm:p-6"
        >
            <div className="grid gap-2">
              <label
                htmlFor="title"
                className="text-sm font-medium text-cream"
              >
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
                placeholder="Friday night pickup"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="venueId"
                className="text-sm font-medium text-cream"
              >
                Venue
              </label>
              <select
                id="venueId"
                name="venueId"
                required
                className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
              >
                <option value="">Select a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name} · {venue.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="startTime"
                  className="text-sm font-medium text-cream"
                >
                  Start time
                </label>
                <input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  required
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="endTime"
                  className="text-sm font-medium text-cream"
                >
                  End time
                </label>
                <input
                  id="endTime"
                  name="endTime"
                  type="datetime-local"
                  required
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="description"
                className="text-sm font-medium text-cream"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
                placeholder="Bring a dark and light shirt. Intermediate pace."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="price"
                  className="text-sm font-medium text-cream"
                >
                  Price
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="maxPlayers"
                  className="text-sm font-medium text-cream"
                >
                  Max players
                </label>
                <input
                  id="maxPlayers"
                  name="maxPlayers"
                  type="number"
                  min="1"
                  step="1"
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
                  placeholder="12"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="skillLevel"
                  className="text-sm font-medium text-cream"
                >
                  Skill level
                </label>
                <select
                  id="skillLevel"
                  name="skillLevel"
                  defaultValue="OPEN"
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
                >
                  <option value="OPEN">Open</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="ageGroup"
                  className="text-sm font-medium text-cream"
                >
                  Age group
                </label>
                <select
                  id="ageGroup"
                  name="ageGroup"
                  defaultValue="ADULT"
                  className="rounded-md border border-white/10 bg-background px-3 py-2 text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
                >
                  <option value="ADULT">Adult</option>
                  <option value="ALL_AGES">All ages</option>
                  <option value="YOUTH">Youth</option>
                  <option value="SENIOR">Senior</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-fit rounded-md bg-court px-4 py-2 text-sm font-semibold text-background transition hover:bg-court-200"
            >
              Create run
            </button>
        </form>
      </section>
    </main>
  );
}
