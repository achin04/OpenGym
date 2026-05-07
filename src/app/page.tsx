export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center bg-zinc-950 px-6 py-16 text-white">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
          OpenGym
        </p>
        <div className="max-w-3xl space-y-5">
          <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            Find your next indoor basketball run.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-300">
            A basketball-first community app for finding, joining, and creating
            local indoor runs.
          </p>
        </div>
        <div className="border-t border-white/10 pt-6 text-sm text-zinc-400">
          Milestone 1 foundation in progress.
        </div>
      </section>
    </main>
  );
}
