import Link from "next/link";
import { AutomatedImportPanel } from "@/app/admin/_components/automated-import-panel";
import { requireAdmin } from "@/server/admin";
import { getAdminAutomatedImportStatus } from "@/server/admin/imported-runs/queries";

export default async function AdminPage() {
  const clerkUser = await requireAdmin();
  const automatedImportStatus = await getAdminAutomatedImportStatus();

  return (
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
            Admin
          </p>

          <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
            OpenGym admin
          </h1>

          <p className="max-w-2xl text-foreground/70">
            Signed in as {clerkUser.primaryEmailAddress?.emailAddress}.
          </p>
        </div>

        <AutomatedImportPanel status={automatedImportStatus} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/venues"
            className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)]"
          >
            <h2 className="text-xl font-semibold">Venues</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Manually add gyms and community centres.
            </p>
          </Link>

          <Link
            href="/admin/schedule-sources"
            className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)]"
          >
            <h2 className="text-xl font-semibold">Schedule Sources</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Track city and university schedule pages.
            </p>
          </Link>

          <Link
            href="/admin/imported-runs"
            className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)]"
          >
            <h2 className="text-xl font-semibold">Imported Runs</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Add verified runs from official sources.
            </p>
          </Link>

          <Link
            href="/admin/imported-venues"
            className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none hover:translate-y-[3px] hover:shadow-[0_3px_0_0_var(--foreground)]"
          >
            <h2 className="text-xl font-semibold">Imported Venues</h2>
            <p className="mt-2 text-sm text-foreground/70">
              Review venues created from source locations.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
