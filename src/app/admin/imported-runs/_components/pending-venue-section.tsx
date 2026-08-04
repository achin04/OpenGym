import { formatDateTime, formatLabel } from "@/lib/formatters";
import type { AdminPendingVenueGroup } from "@/server/admin/imported-runs/queries";

type PendingVenueSectionProps = {
  groups: AdminPendingVenueGroup[];
};

function displayValue(value: string | null | undefined) {
  return value && value.trim() !== "" ? value : "Unknown";
}

function exampleTimeLabel(startTime: string | null | undefined) {
  if (!startTime) {
    return "Unknown time";
  }

  const date = new Date(startTime);

  return Number.isNaN(date.getTime()) ? "Unknown time" : formatDateTime(date);
}

function venueReasonLabel(group: AdminPendingVenueGroup) {
  const reasons = Array.from(
    new Set(
      group.examples.flatMap((item) => {
        return item.payload?.venueMatchReason
          ? [item.payload.venueMatchReason]
          : [];
      }),
    ),
  );

  return reasons.length > 0 ? reasons.map(formatLabel).join(", ") : "Unknown";
}

export function PendingVenueSection({ groups }: PendingVenueSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Unresolved venue exceptions</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Most Toronto source locations are matched or created automatically.
          These skipped candidates still need manual investigation before they
          can be imported.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          No unresolved Toronto venues in this batch.
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <article
              key={group.externalVenueRef.id}
              className="grid gap-6 overflow-hidden rounded-lg border border-white/10 bg-white/5 p-6"
            >
              <div className="min-w-0 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    Toronto source location
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-zinc-100">
                    {group.externalVenueRef.sourceName}
                  </h3>
                  <p className="mt-2 text-zinc-300">
                    {displayValue(group.externalVenueRef.sourceAddressLine1)}
                    {group.externalVenueRef.sourcePostalCode
                      ? `, ${group.externalVenueRef.sourcePostalCode}`
                      : ""}
                  </p>
                </div>

                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">Toronto Location ID</dt>
                    <dd className="mt-1 text-zinc-100">
                      {group.externalVenueRef.externalId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Match status</dt>
                    <dd className="mt-1 text-zinc-100">
                      {group.externalVenueRef.matchStatus}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Skipped candidates</dt>
                    <dd className="mt-1 text-zinc-100">{group.itemCount}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Review reason</dt>
                    <dd className="mt-1 text-zinc-100">
                      {venueReasonLabel(group)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Source URL</dt>
                    <dd className="mt-1 break-words text-zinc-100">
                      {group.externalVenueRef.sourceUrl ? (
                        <a
                          href={group.externalVenueRef.sourceUrl}
                          className="text-emerald-300 hover:text-emerald-200"
                        >
                          View Toronto source
                        </a>
                      ) : (
                        "Unknown"
                      )}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h4 className="text-sm font-semibold text-zinc-100">
                    Example skipped candidates
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                    {group.examples.map((item) => (
                      <li key={item.id}>
                        <span className="text-zinc-100">
                          {displayValue(item.payload?.title)}
                        </span>
                        <span className="text-zinc-500">
                          {" "}
                          · {exampleTimeLabel(item.payload?.startTime)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
