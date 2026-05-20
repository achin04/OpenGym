import { prisma } from "@/server/db";
import { notFound } from "next/navigation";
import { formatDateTime, formatPrice, formatLabel } from "@/lib/formatters";

type RunDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RunDetailsPage({ params }: RunDetailsPageProps) {
  const { id } = await params;

  const run = await prisma.run.findUnique({
    where: {
        id: id,
    },
    include: {
        venue: true,
        _count: {
            select: {
                rsvps: true,
            }
        }
    }
  });

  if (!run) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-5xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
          Run Details
        </p>

        <h1 className="text-4xl font-semibold tracking-normal">
          {run.title}
        </h1>
        <p className="text-zinc-300">
          {run.description ?? "No description has been added yet."}
        </p>

        <p className="text-zinc-300">Run ID: {run.id}</p>
        <p className="text-zinc-300">RSVP count: {run._count.rsvps}</p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">Venue</h2>

            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <dt className="text-zinc-500">Name</dt>
                    <dd className="text-zinc-100">{run.venue.name}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Address</dt>
                    <dd className="text-zinc-100">{run.venue.addressLine1}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">City</dt>
                    <dd className="text-zinc-100">{run.venue.city}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Starts</dt>
                    <dd className="text-zinc-100">{formatDateTime(run.startTime)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Ends</dt>
                    <dd className="text-zinc-100">{formatDateTime(run.endTime)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Price</dt>
                    <dd className="text-zinc-100">{formatPrice(run.price)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Skill level</dt>
                    <dd className="text-zinc-100">{formatLabel(run.skillLevel)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Age group</dt>
                    <dd className="text-zinc-100">{formatLabel(run.ageGroup)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Max players</dt>
                    <dd className="text-zinc-100">{run.maxPlayers ?? "No limit listed"}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Source type</dt>
                    <dd className="text-zinc-100">{formatLabel(run.sourceType)}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Verified</dt>
                    <dd className="text-zinc-100">{run.verified ? "Yes" : "No"}</dd>
                </div>

                <div>
                    <dt className="text-zinc-500">Source URL</dt>
                    <dd className="text-zinc-100">
                    {run.sourceUrl ?? "No source URL listed"}
                    </dd>
                </div>
                </dl>
            </div>
      </section>
    </main>
  );
}