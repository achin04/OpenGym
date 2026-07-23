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

function itemTimeLabel(item: AdminImportItemDisplay) {
  const startTime = item.payload?.startTime
    ? new Date(item.payload.startTime)
    : null;
  const endTime = item.payload?.endTime ? new Date(item.payload.endTime) : null;

  if (!startTime || Number.isNaN(startTime.getTime())) {
    return "Unknown";
  }

  if (!endTime || Number.isNaN(endTime.getTime())) {
    return formatDateTime(startTime);
  }

  return `${formatDateTime(startTime)} to ${formatDateTime(endTime)}`;
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
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          No items in this group.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
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
                <tr key={item.id} className="bg-white/[0.03] align-top">
                  <td className="px-4 py-4 text-zinc-100">
                    {displayValue(item.payload?.title)}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {itemTimeLabel(item)}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    <div>
                      {displayValue(
                        item.payload?.location?.sourceName ??
                          item.payload?.sourceLocationId,
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      ID {displayValue(item.payload?.sourceLocationId)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {formatLabel(item.action)}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {formatLabel(item.reviewStatus)}
                  </td>
                  <td className="px-4 py-4">
                    {item.runId ? (
                      <Link
                        href={`/runs/${item.runId}`}
                        className="font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        View run
                      </Link>
                    ) : (
                      <span className="text-zinc-500">None</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {item.errorMessage ??
                      item.payload?.venueMatchReason ??
                      "None"}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {item.fieldDiffs.length === 0 ? (
                      <span className="text-zinc-500">None</span>
                    ) : (
                      <ul className="space-y-2">
                        {item.fieldDiffs.map((diff) => (
                          <li key={diff.field}>
                            <div className="font-medium text-zinc-100">
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
