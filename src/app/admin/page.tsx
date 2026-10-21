import Link from "next/link";
import { AutomatedImportPanel } from "@/app/admin/_components/automated-import-panel";
import { requireAdmin } from "@/server/admin";
import { getAdminAutomatedImportStatus } from "@/server/admin/imported-runs/queries";

export default async function AdminPage() {
  const clerkUser = await requireAdmin();
  const automatedImportStatus = await getAdminAutomatedImportStatus();

  return (
    <main className="flex-1 bg-white px-6 py-12 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Admin
          </p>

          <h1 className="text-4xl font-semibold tracking-normal">
            OpenGym admin
          </h1>

          <p className="max-w-2xl text-zinc-600">
            Signed in as {clerkUser.primaryEmailAddress?.emailAddress}.
          </p>
        </div>

        <AutomatedImportPanel status={automatedImportStatus} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/venues"
            className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 hover:bg-foreground/10"
          >
            <h2 className="text-xl font-semibold">Venues</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Manually add gyms and community centres.
            </p>
          </Link>

          <Link
            href="/admin/schedule-sources"
            className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 hover:bg-foreground/10"
          >
            <h2 className="text-xl font-semibold">Schedule Sources</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Track city and university schedule pages.
            </p>
          </Link>

          <Link
            href="/admin/imported-runs"
            className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 hover:bg-foreground/10"
          >
            <h2 className="text-xl font-semibold">Imported Runs</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Add verified runs from official sources.
            </p>
          </Link>

          <Link
            href="/admin/imported-venues"
            className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 hover:bg-foreground/10"
          >
            <h2 className="text-xl font-semibold">Imported Venues</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Review venues created from source locations.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
