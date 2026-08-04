import Link from "next/link";
import { formatDateTime, formatLabel } from "@/lib/formatters";
import {
  getAdminImportedVenueCreations,
  type AdminImportedVenueCreationListItem,
} from "@/server/admin/imported-runs/queries";
import { requireAdmin } from "@/server/admin";
import { ImportedVenueActions } from "./_components/imported-venue-actions";

function sourceAddress(row: AdminImportedVenueCreationListItem) {
  const parts = [row.sourceAddressLine1, row.sourcePostalCode].filter(
    (part): part is string => Boolean(part),
  );

  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

function venueAddress(row: AdminImportedVenueCreationListItem) {
  if (!row.venue) {
    return "Removed";
  }

  return [
    row.venue.addressLine1,
    row.venue.addressLine2,
    row.venue.city,
    row.venue.postalCode,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

export default async function AdminImportedVenuesPage() {
  await requireAdmin();

  const venueCreations = await getAdminImportedVenueCreations();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-4">
          <Link
            href="/admin"
            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Back to admin
          </Link>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Admin
            </p>

            <h1 className="text-4xl font-semibold tracking-normal">
              Imported Venues
            </h1>

            <p className="max-w-3xl text-zinc-300">
              Review venues that were automatically created from source
              locations during dry-run imports.
            </p>
          </div>
        </div>

        {venueCreations.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-zinc-300">
            No imported venues have been created yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Created venue</th>
                  <th className="px-4 py-3 font-semibold">External ref</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {venueCreations.map((row) => (
                  <tr key={row.id} className="bg-white/[0.03] align-top">
                    <td className="px-4 py-4 text-zinc-300">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/imported-runs/${row.batch.id}`}
                        className="font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        View batch
                      </Link>
                      <div className="mt-1 text-xs text-zinc-500">
                        {formatLabel(row.batch.status)} ·{" "}
                        {row.batch.trigger ?? "Unknown trigger"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {row.batch.scheduleSource.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div className="font-medium text-zinc-100">
                        {row.sourceUrl ? (
                          <a
                            href={row.sourceUrl}
                            className="text-emerald-300 hover:text-emerald-200"
                          >
                            {row.sourceName}
                          </a>
                        ) : (
                          row.sourceName
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {sourceAddress(row)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div className="font-medium text-zinc-100">
                        {row.venue ? row.venue.name : "Removed venue"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {venueAddress(row)}
                      </div>
                      {row.venue?.websiteUrl ? (
                        <a
                          href={row.venue.websiteUrl}
                          className="mt-2 inline-block text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                        >
                          Venue website
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div>ID {row.externalVenueRef.externalId}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {row.externalVenueRef.id}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          row.removedAt
                            ? "rounded-full border border-zinc-500/40 px-3 py-1 text-xs font-semibold text-zinc-400"
                            : "rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200"
                        }
                      >
                        {row.removedAt
                          ? "Removed"
                          : formatLabel(row.externalVenueRef.matchStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <ImportedVenueActions
                        importedVenueCreationId={row.id}
                        venue={row.venue}
                        removed={Boolean(row.removedAt)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
