import { describe, expect, it } from "vitest";
import { groupByDay, torontoDayKey } from "./day-groups";

const at = (iso: string) => ({ startTime: new Date(iso) });
const group = (items: { startTime: Date }[], now: string) =>
  groupByDay(items, (item) => item.startTime, new Date(now));

describe("torontoDayKey", () => {
  // The whole reason this module exists. In UTC this instant is already the
  // 25th; in Toronto it is still Saturday evening on the 24th, and the listing
  // has to say Saturday.
  it("uses the Toronto day, not UTC", () => {
    expect(torontoDayKey(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-24");
  });

  // Toronto is UTC-4 here (DST runs to Nov 1), so midnight local is 04:00Z.
  // 03:30Z is still the 24th; 04:30Z has crossed into the 25th.
  it("handles the hour either side of midnight in Toronto", () => {
    expect(torontoDayKey(new Date("2026-10-25T03:30:00Z"))).toBe("2026-10-24");
    expect(torontoDayKey(new Date("2026-10-25T04:30:00Z"))).toBe("2026-10-25");
  });

  // After the clocks go back Toronto is UTC-5, so the boundary moves an hour.
  it("follows the clock change rather than a fixed offset", () => {
    expect(torontoDayKey(new Date("2026-11-10T04:30:00Z"))).toBe("2026-11-09");
    expect(torontoDayKey(new Date("2026-11-10T05:30:00Z"))).toBe("2026-11-10");
  });
});

describe("groupByDay", () => {
  it("labels the first two days Today and Tomorrow", () => {
    const groups = group(
      [at("2026-10-24T14:15:00Z"), at("2026-10-25T19:00:00Z")],
      "2026-10-24T12:00:00Z",
    );

    expect(groups.map((g) => g.label)).toEqual(["Today", "Tomorrow"]);
    expect(groups[0]!.dateLabel).toBe("Saturday, Oct 24");
    expect(groups[1]!.dateLabel).toBe("Sunday, Oct 25");
  });

  it("labels later days by weekday and drops the weekday from the date", () => {
    const groups = group([at("2026-10-31T18:00:00Z")], "2026-10-24T12:00:00Z");

    expect(groups[0]!.label).toBe("Saturday");
    expect(groups[0]!.dateLabel).toBe("Oct 31");
  });

  it("collects every run that falls on the same Toronto day", () => {
    const groups = group(
      [
        at("2026-10-24T14:00:00Z"),
        at("2026-10-24T23:00:00Z"),
        at("2026-10-25T02:00:00Z"),
        at("2026-10-25T19:00:00Z"),
      ],
      "2026-10-24T12:00:00Z",
    );

    expect(groups).toHaveLength(2);
    // The 02:00Z run is still the 24th in Toronto, so it belongs to Today.
    expect(groups[0]!.items).toHaveLength(3);
    expect(groups[1]!.items).toHaveLength(1);
  });

  it("keeps the order the listing was already sorted in", () => {
    const groups = group(
      [at("2026-10-24T14:00:00Z"), at("2026-11-02T14:00:00Z"), at("2026-10-26T14:00:00Z")],
      "2026-10-24T12:00:00Z",
    );

    expect(groups.map((g) => g.key)).toEqual([
      "2026-10-24",
      "2026-11-02",
      "2026-10-26",
    ]);
  });

  it("returns nothing for an empty listing", () => {
    expect(group([], "2026-10-24T12:00:00Z")).toEqual([]);
  });
});
