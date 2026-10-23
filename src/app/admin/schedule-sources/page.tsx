import { formatLabel } from "@/lib/formatters";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { createScheduleSource } from "./actions";
import { raisedButtonClass } from "@/app/_components/raised-button";

export default async function AdminScheduleSourcesPage() {
  await requireAdmin();

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
            Schedule Sources
          </h1>

          <p className="max-w-2xl text-foreground/70">
            Track the official city or university pages used for manual imports.
          </p>
        </div>

        <form
          action={createScheduleSource}
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
              placeholder="City of Toronto Drop-in Basketball"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="sourceType"
              className="text-sm font-semibold text-foreground"
            >
              Source type
            </label>
            <select
              id="sourceType"
              name="sourceType"
              required
              defaultValue="CITY"
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            >
              <option value="CITY">City</option>
              <option value="UNIVERSITY">University</option>
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="url" className="text-sm font-semibold text-foreground">
              Source URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://..."
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="notes"
              className="text-sm font-semibold text-foreground"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Optional admin notes about this schedule."
              className="min-h-11 w-full min-w-0 rounded-[10px] border-2 border-foreground bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-placeholder focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-court"
            />
          </div>

          <button
            type="submit"
            className={`w-fit ${raisedButtonClass({ variant: "success" })}`}
          >
            Create schedule source
          </button>
        </form>

        <div className="grid gap-4">
          {scheduleSources.map((source) => (
            <article
              key={source.id}
              className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{source.name}</h2>
                  <p className="mt-2 text-foreground/70">{source.url}</p>
                </div>

                <span className="w-fit rounded-full border-2 border-foreground bg-white px-3 py-1 text-sm font-semibold text-foreground">
                  {formatLabel(source.sourceType)}
                </span>
              </div>

              {source.notes ? (
                <p className="mt-4 text-sm text-foreground/60">{source.notes}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
