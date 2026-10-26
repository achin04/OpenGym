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
    <main className="flex-1 px-5 py-8 text-foreground sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-6">
          <Link
            href="/admin"
            className="inline-block text-sm font-semibold text-foreground underline underline-offset-2 hover:text-link-hover"
          >
            Back to admin
          </Link>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-court">
              Admin
            </p>

            <h1 className="text-[clamp(32px,4vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
              Imported Venues
            </h1>

            <p className="max-w-3xl text-foreground/70">
              Review venues that were automatically created from source
              locations during dry-run imports.
            </p>
          </div>
        </div>

        {venueCreations.length === 0 ? (
          <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] text-foreground/70">
            No imported venues have been created yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[16px] border-2 border-foreground bg-surface">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-foreground/[0.07] text-xs uppercase tracking-[0.14em] text-foreground/60">
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
              <tbody className="divide-y-2 divide-line">
                {venueCreations.map((row) => (
                  <tr key={row.id} className="bg-foreground/[0.03] align-top">
                    <td className="px-4 py-4 text-foreground/70">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/imported-runs/${row.batch.id}`}
                        className="font-semibold text-foreground underline underline-offset-2 hover:text-link-hover"
                      >
                        View batch
                      </Link>
                      <div className="mt-1 text-xs text-foreground/60">
                        {formatLabel(row.batch.status)} ·{" "}
                        {row.batch.trigger ?? "Unknown trigger"}
                      </div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {row.batch.scheduleSource.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      <div className="font-semibold text-foreground">
                        {row.sourceUrl ? (
                          <a
                            href={row.sourceUrl}
                            className="text-foreground underline underline-offset-2 hover:text-link-hover"
                          >
                            {row.sourceName}
                          </a>
                        ) : (
                          row.sourceName
                        )}
                      </div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {sourceAddress(row)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      <div className="font-semibold text-foreground">
                        {row.venue ? row.venue.name : "Removed venue"}
                      </div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {venueAddress(row)}
                      </div>
                      {row.venue?.websiteUrl ? (
                        <a
                          href={row.venue.websiteUrl}
                          className="mt-2 inline-block text-xs font-semibold text-foreground underline underline-offset-2 hover:text-link-hover"
                        >
                          Venue website
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-foreground/70">
                      <div>ID {row.externalVenueRef.externalId}</div>
                      <div className="mt-1 text-xs text-foreground/60">
                        {row.externalVenueRef.id}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          row.removedAt
                            ? "rounded-full border-2 border-foreground/35 px-3 py-1 text-xs font-semibold text-foreground/55"
                            : "rounded-full border-2 border-foreground bg-white px-3 py-1 text-xs font-semibold text-foreground"
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
