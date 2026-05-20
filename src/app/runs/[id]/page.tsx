import { prisma } from "@/server/db";

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
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <section className="mx-auto w-full max-w-5xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-300">
            Run Not Found
          </p>

          <h1 className="text-4xl font-semibold tracking-normal">
            No run exists with this ID.
          </h1>

          <p className="text-zinc-300">Requested ID: {id}</p>
        </section>
      </main>
    );
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

        <p className="text-zinc-300">Run ID: {run.id}</p>
        <p className="text-zinc-300">RSVP count: {run._count.rsvps}</p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold">Venue</h2>

            <dl className="mt-4 space-y-3 text-sm">
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
            </dl>
            </div>
      </section>
    </main>
  );
}