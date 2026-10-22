import Link from "next/link";
import { raisedButtonClass } from "@/app/_components/raised-button";

export default function RunNotFound() {
  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
          Run not found
        </p>

        <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
          No run exists with this ID.
        </h1>

        <p className="max-w-2xl text-foreground/70">
          Please check the URL and try again.
        </p>

        <Link href="/runs" className={`mt-2 ${raisedButtonClass()}`}>
          Back to runs
        </Link>
      </section>
    </main>
  );
}
