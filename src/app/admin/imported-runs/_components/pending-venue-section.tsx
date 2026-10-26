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
        <p className="mt-2 max-w-3xl text-sm text-foreground/60">
          Most Toronto source locations are matched or created automatically.
          These skipped candidates still need manual investigation before they
          can be imported.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)] text-sm text-foreground/60">
          No unresolved Toronto venues in this batch.
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map((group) => (
            <article
              key={group.externalVenueRef.id}
              className="grid gap-6 overflow-hidden rounded-[20px] border-2 border-foreground bg-surface p-6 shadow-[0_6px_0_0_var(--foreground)]"
            >
              <div className="min-w-0 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-court">
                    Toronto source location
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {group.externalVenueRef.sourceName}
                  </h3>
                  <p className="mt-2 text-foreground/70">
                    {displayValue(group.externalVenueRef.sourceAddressLine1)}
                    {group.externalVenueRef.sourcePostalCode
                      ? `, ${group.externalVenueRef.sourcePostalCode}`
                      : ""}
                  </p>
                </div>

                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-foreground/60">Toronto Location ID</dt>
                    <dd className="mt-1 text-foreground">
                      {group.externalVenueRef.externalId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground/60">Match status</dt>
                    <dd className="mt-1 text-foreground">
                      {group.externalVenueRef.matchStatus}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground/60">Skipped candidates</dt>
                    <dd className="mt-1 text-foreground">{group.itemCount}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground/60">Review reason</dt>
                    <dd className="mt-1 text-foreground">
                      {venueReasonLabel(group)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground/60">Source URL</dt>
                    <dd className="mt-1 break-words text-foreground">
                      {group.externalVenueRef.sourceUrl ? (
                        <a
                          href={group.externalVenueRef.sourceUrl}
                          className="text-foreground underline underline-offset-2 hover:text-link-hover"
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
                  <h4 className="text-sm font-semibold text-foreground">
                    Example skipped candidates
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/70">
                    {group.examples.map((item) => (
                      <li key={item.id}>
                        <span className="text-foreground">
                          {displayValue(item.payload?.title)}
                        </span>
                        <span className="text-foreground/60">
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
