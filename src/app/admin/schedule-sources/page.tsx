import { formatLabel } from "@/lib/formatters";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { createScheduleSource } from "./actions";

export default async function AdminScheduleSourcesPage() {
  await requireAdmin();

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
            Schedule Sources
          </h1>

          <p className="max-w-2xl text-zinc-600">
            Track the official city or university pages used for manual imports.
          </p>
        </div>

        <form
          action={createScheduleSource}
          className="grid gap-6 rounded-lg border border-foreground/10 bg-foreground/5 p-6"
        >
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-900">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="City of Toronto Drop-in Basketball"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="sourceType"
              className="text-sm font-medium text-zinc-900"
            >
              Source type
            </label>
            <select
              id="sourceType"
              name="sourceType"
              required
              defaultValue="CITY"
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            >
              <option value="CITY">City</option>
              <option value="UNIVERSITY">University</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="url" className="text-sm font-medium text-zinc-900">
              Source URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://..."
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-zinc-900"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Optional admin notes about this schedule."
              className="rounded-md border border-foreground/10 bg-zinc-100 px-3 py-2 text-foreground"
            />
          </div>

          <button
            type="submit"
            className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            Create schedule source
          </button>
        </form>

        <div className="grid gap-4">
          {scheduleSources.map((source) => (
            <article
              key={source.id}
              className="rounded-lg border border-foreground/10 bg-foreground/5 p-6"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{source.name}</h2>
                  <p className="mt-2 text-zinc-600">{source.url}</p>
                </div>

                <span className="w-fit rounded-full border border-emerald-400/30 px-3 py-1 text-sm text-emerald-700">
                  {formatLabel(source.sourceType)}
                </span>
              </div>

              {source.notes ? (
                <p className="mt-4 text-sm text-zinc-500">{source.notes}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
