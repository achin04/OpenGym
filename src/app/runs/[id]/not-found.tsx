import Link from "next/link";

export default function RunNotFound() {
    return (
        <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
          <section className="mx-auto w-full max-w-5xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-red-300">
              Run Not Found
            </p>

            <h1 className="text-4xl font-semibold tracking-normal">
              No run exists with this ID.
            </h1>

            <p className="text-zinc-300">Please check the URL and try again.</p>

            <Link
              href="/runs"
              className="inline-block rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Back to Runs
            </Link>
          </section>
        </main>
      );
    }