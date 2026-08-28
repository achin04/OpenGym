import Link from "next/link";
import { BrandMark } from "./_components/brand";

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-4.5rem)] px-5 py-10 sm:px-6 sm:py-16">
      <section className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div className="max-w-3xl space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-court-200">
              <BrandMark size="sm" />
              Pickup, mapped
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-cream sm:text-6xl">
              Find basketball runs near you.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-cream/68">
              Enter a city or neighborhood, set when you can play, and OpenGym
              surfaces the closest-fit drop-in runs first.
            </p>
          </div>

          <form
            action="/runs"
            className="grid gap-3 rounded-lg border border-line bg-ink-900/84 p-3 shadow-2xl shadow-black/25 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"
          >
            <div className="grid gap-1 px-1">
              <label
                htmlFor="home-location"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
              >
                City or area
              </label>
              <input
                id="home-location"
                name="location"
                type="search"
                autoComplete="address-level2"
                placeholder="Toronto, North York, Scarborough"
                className="min-h-12 rounded-md border border-white/10 bg-background px-4 text-base text-cream outline-none transition placeholder:text-cream/30 focus:border-court focus:ring-2 focus:ring-court/20"
              />
            </div>

            <div className="grid gap-1 px-1">
              <label
                htmlFor="home-availability"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-cream/45"
              >
                Availability
              </label>
              <select
                id="home-availability"
                name="availability"
                defaultValue="upcoming"
                className="min-h-12 rounded-md border border-white/10 bg-background px-4 text-base text-cream outline-none transition focus:border-court focus:ring-2 focus:ring-court/20"
              >
                <option value="upcoming">Upcoming</option>
                <option value="today">Today</option>
                <option value="tonight">Tonight</option>
                <option value="week">Next 7 days</option>
                <option value="weekend">Weekend</option>
              </select>
            </div>

            <button
              type="submit"
              className="min-h-12 rounded-md bg-court px-5 text-sm font-semibold text-background transition hover:bg-court-200 focus:outline-none focus:ring-2 focus:ring-court/50"
            >
              Find runs
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 text-sm text-cream/58">
            <span>Popular:</span>
            {["Toronto", "Etobicoke", "North York", "Scarborough"].map(
              (area) => (
                <Link
                  key={area}
                  href={`/runs?location=${encodeURIComponent(area)}&availability=upcoming`}
                  className="rounded-full border border-line px-3 py-1.5 text-cream/76 transition hover:border-court/60 hover:text-cream"
                >
                  {area}
                </Link>
              ),
            )}
          </div>
        </div>

        <aside className="court-key overflow-hidden rounded-lg border border-line bg-ink-900/70 p-6">
          <div className="relative z-10 space-y-6">
            <div>
              <p className="text-sm font-medium text-court-200">Match board</p>
              <p className="mt-2 text-3xl font-semibold text-cream">
                Location, time, level.
              </p>
            </div>

            <div className="grid gap-3 text-sm">
              {[
                ["Area fit", "City and venue match"],
                ["Availability", "Today, tonight, week"],
                ["Run details", "Price, level, capacity"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-cream/48">{label}</span>
                  <span className="font-medium text-cream">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <div className="h-px w-full bg-line" />
          <div className="grid gap-4 py-8 text-sm text-cream/58 sm:grid-cols-3">
            <p>
              Built for players who want a fast answer: where to play, when it
              starts, and whether the run fits.
            </p>
            <p>
              Dark, minimal surfaces keep the focus on the schedule while court
              lines and warm accents carry the basketball feel.
            </p>
            <p>
              Imported municipal and community runs can live beside user-created
              pickup sessions.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
