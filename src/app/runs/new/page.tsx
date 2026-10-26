import {
  FIELD,
  FORM_LABEL,
  SELECT_FIELD,
  TEXTAREA_FIELD,
} from "@/app/_components/field";
import { raisedButtonClass } from "@/app/_components/raised-button";
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
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
            Add a basketball run
          </h1>

          <p className="max-w-2xl text-foreground/70">
            Share an indoor basketball run with the OpenGym community.
          </p>
        </div>

        <form
          action={createRun}
          className="grid gap-6 rounded-[20px] border-2 border-foreground bg-surface p-5 shadow-[0_6px_0_0_var(--foreground)] sm:p-7"
        >
            <div className="grid gap-2">
              <label
                htmlFor="title"
                className={FORM_LABEL}
              >
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className={FIELD}
                placeholder="Friday night pickup"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="venueId"
                className={FORM_LABEL}
              >
                Venue
              </label>
              <select
                id="venueId"
                name="venueId"
                required
                className={SELECT_FIELD}
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
                  className={FORM_LABEL}
                >
                  Start time
                </label>
                <input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  required
                  className={FIELD}
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="endTime"
                  className={FORM_LABEL}
                >
                  End time
                </label>
                <input
                  id="endTime"
                  name="endTime"
                  type="datetime-local"
                  required
                  className={FIELD}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="description"
                className={FORM_LABEL}
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className={TEXTAREA_FIELD}
                placeholder="Bring a dark and light shirt. Intermediate pace."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="price"
                  className={FORM_LABEL}
                >
                  Price
                </label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={FIELD}
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="maxPlayers"
                  className={FORM_LABEL}
                >
                  Max players
                </label>
                <input
                  id="maxPlayers"
                  name="maxPlayers"
                  type="number"
                  min="1"
                  step="1"
                  className={FIELD}
                  placeholder="12"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  htmlFor="skillLevel"
                  className={FORM_LABEL}
                >
                  Skill level
                </label>
                <select
                  id="skillLevel"
                  name="skillLevel"
                  defaultValue="OPEN"
                  className={SELECT_FIELD}
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
                  className={FORM_LABEL}
                >
                  Age group
                </label>
                <select
                  id="ageGroup"
                  name="ageGroup"
                  defaultValue="ADULT"
                  className={SELECT_FIELD}
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
              className={`w-fit ${raisedButtonClass({ variant: "solid" })}`}
            >
              Create run
            </button>
        </form>
      </section>
    </main>
  );
}
