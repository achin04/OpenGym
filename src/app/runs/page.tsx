import {prisma} from "@/server/db";
import Link from "next/link";

function formatDateTime(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Toronto"
    }).format(date);
}

function formatPrice(price: {toString: () => string } | null) {
    if (price === null) {
        return "Free";
    }

    const amount = Number(price.toString());

    if (amount === 0 ) {
        return "Free";
    }

    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(amount);
}

function formatLabel(value: string) {
    return value
        .toLowerCase()
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ");
}

export default async function RunsPage() {
    const runs = await prisma.run.findMany({
        include: {
            venue: true,
        },
        orderBy: {
            startTime: "asc",
        },
    });

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Basketball Runs
          </p>
          <h1 className="text-4xl font-semibold tracking-normal">
            Browse upcoming runs
          </h1>
          <p className="max-w-2xl text-zinc-300">
            Find indoor basketball runs pulled from the OpenGym database.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-zinc-300">
            No basketball runs are available yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {runs.map((run) => (
              <article
                key={run.id}
                className="rounded-lg border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">
                      <Link href={`/runs/${run.id}`} className="hover:underline">
                        {run.title}
                      </Link>
                    </h2>
                    <p className="text-zinc-300">
                      {run.venue.name} · {run.venue.city}
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-emerald-400/30 px-3 py-1 text-sm text-emerald-200">
                    {run.verified ? "Verified" : "Unverified"}
                  </span>
                </div>

                <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">Starts</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatDateTime(run.startTime)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Ends</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatDateTime(run.endTime)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Price</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatPrice(run.price)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Source</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatLabel(run.sourceType)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Skill level</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatLabel(run.skillLevel)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-zinc-500">Age group</dt>
                    <dd className="mt-1 text-zinc-100">
                      {formatLabel(run.ageGroup)}
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