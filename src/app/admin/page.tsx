import Link from "next/link";
import { requireAdmin } from "@/server/admin";

export default async function AdminPage() {
    const clerkUser = await requireAdmin();

    return (
        <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <section className="mx-auto w-full max-w-5xl space-y-8">
            <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                Admin
            </p>

            <h1 className="text-4xl font-semibold tracking-normal">
                OpenGym admin
            </h1>

            <p className="max-w-2xl text-zinc-300">
                Signed in as {clerkUser.primaryEmailAddress?.emailAddress}.
            </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
            <Link
                href="/admin/venues"
                className="rounded-lg border border-white/10 bg-white/5 p-6 hover:bg-white/10"
            >
                <h2 className="text-xl font-semibold">Venues</h2>
                <p className="mt-2 text-sm text-zinc-300">
                Manually add gyms and community centres.
                </p>
            </Link>

            <Link
                href="/admin/schedule-sources"
                className="rounded-lg border border-white/10 bg-white/5 p-6 hover:bg-white/10"
            >
                <h2 className="text-xl font-semibold">Schedule Sources</h2>
                <p className="mt-2 text-sm text-zinc-300">
                Track city and university schedule pages.
                </p>
            </Link>

            <Link
                href="/admin/imported-runs/new"
                className="rounded-lg border border-white/10 bg-white/5 p-6 hover:bg-white/10"
            >
                <h2 className="text-xl font-semibold">Imported Runs</h2>
                <p className="mt-2 text-sm text-zinc-300">
                Add verified runs from official sources.
                </p>
            </Link>
            </div>
        </section>
        </main>
  );
}