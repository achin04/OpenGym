// src/app/admin/imported-runs/page.tsx
import Link from "next/link";
import { RunSourceType } from "@/generated/prisma/enums";
import { formatDateTime, formatLabel, formatPrice } from "@/lib/formatters";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";

export default async function AdminImportedRunsPage() {
  await requireAdmin();

  const runs = await prisma.run.findMany({
    where: {
      sourceType: {
        in: [RunSourceType.CITY, RunSourceType.UNIVERSITY],
      },
    },
    include: {
      venue: true,
      scheduleSource: true,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Admin
            </p>

            <h1 className="text-4xl font-semibold tracking-normal">
              Imported Runs
            </h1>

            <p className="max-w-2xl text-zinc-300">
              Review manually imported city and university runs.
            </p>
          </div>

          <Link
            href="/admin/imported-runs/new"
            className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            New imported run
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-zinc-300">
            No imported runs have been added yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {runs.map((run) => (
              <article key={run.id} className="rounded-lg border border-white/10 bg-white/5 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      <Link href={`/runs/${run.id}`} className="hover:underline">
                        {run.title}
                      </Link>
                    </h2>

                    <p className="mt-2 text-zinc-300">
                      {run.venue.name} · {run.venue.city}
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-emerald-400/30 px-3 py-1 text-sm text-emerald-200">
                    {formatLabel(run.sourceType)}
                  </span>
                </div>

                <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">Starts</dt>
                    <dd className="mt-1 text-zinc-100">{formatDateTime(run.startTime)}</dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Ends</dt>
                    <dd className="mt-1 text-zinc-100">{formatDateTime(run.endTime)}</dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Price</dt>
                    <dd className="mt-1 text-zinc-100">{formatPrice(run.price)}</dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Schedule source</dt>
                    <dd className="mt-1 text-zinc-100">
                      {run.scheduleSource?.name ?? "No source"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}