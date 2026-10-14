import Link from "next/link";
import { formatDateTime, formatLabel } from "@/lib/formatters";
import type { AdminImportItemDisplay } from "@/server/admin/imported-runs/queries";

type ImportItemTableProps = {
  title: string;
  description?: string;
  items: AdminImportItemDisplay[];
};

function displayValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  return String(value);
}

function parsedDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Apply items store no payload once their Run exists, so the Run is the source
// for these columns. The payload still wins when present, because a dry-run
// item describes what is *proposed* and may differ from the Run as it stands.
function itemTimeLabel(item: AdminImportItemDisplay) {
  const startTime = parsedDate(item.payload?.startTime) ?? item.run?.startTime;
  const endTime = parsedDate(item.payload?.endTime) ?? item.run?.endTime;

  if (!startTime) {
    return "Unknown";
  }

  if (!endTime) {
    return formatDateTime(startTime);
  }

  return `${formatDateTime(startTime)} to ${formatDateTime(endTime)}`;
}

function itemLocationLabel(item: AdminImportItemDisplay) {
  return (
    item.payload?.location?.sourceName ??
    item.payload?.sourceLocationId ??
    item.run?.venueName ??
    null
  );
}

export function ImportItemTable({
  title,
  description,
  items,
}: ImportItemTableProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-6 text-sm text-zinc-500">
          No items in this group.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-foreground/5 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Date and time</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Review</th>
                <th className="px-4 py-3 font-semibold">Linked run</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Diffs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((item) => (
                <tr key={item.id} className="bg-foreground/[0.03] align-top">
                  <td className="px-4 py-4 text-zinc-900">
                    {displayValue(item.payload?.title ?? item.run?.title)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {itemTimeLabel(item)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    <div>{displayValue(itemLocationLabel(item))}</div>
                    {item.payload?.sourceLocationId ? (
                      <div className="mt-1 text-xs text-zinc-500">
                        ID {item.payload.sourceLocationId}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatLabel(item.action)}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {formatLabel(item.reviewStatus)}
                  </td>
                  <td className="px-4 py-4">
                    {item.runId ? (
                      <Link
                        href={`/runs/${item.runId}`}
                        className="font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        View run
                      </Link>
                    ) : (
                      <span className="text-zinc-500">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.errorMessage ??
                      item.payload?.venueMatchReason ??
                      "None"}
                  </td>
                  <td className="px-4 py-4 text-zinc-600">
                    {item.fieldDiffs.length === 0 ? (
                      <span className="text-zinc-500">None</span>
                    ) : (
                      <ul className="space-y-2">
                        {item.fieldDiffs.map((diff) => (
                          <li key={diff.field}>
                            <div className="font-medium text-zinc-900">
                              {diff.field}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {displayValue(diff.current)} to{" "}
                              {displayValue(diff.proposed)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
