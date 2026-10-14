import { describe, expect, it } from "vitest";
import {
  getAvailabilityRange,
  type AvailabilityFilter,
} from "./availability";

// A Wednesday afternoon, so "weekend" looks forward and nothing is clamped.
const WEDNESDAY = new Date("2026-10-14T14:30:00.000Z");
// A Saturday afternoon, the case where a window starting at midnight is
// already partly in the past.
const SATURDAY = new Date("2026-10-17T14:30:00.000Z");

describe("getAvailabilityRange", () => {
  it("floors 'any time' at the present and leaves it open-ended", () => {
    const range = getAvailabilityRange("any", WEDNESDAY);

    // The regression this was written for: "any" used to apply no date filter
    // at all, so every run ever imported stayed on the listing forever.
    expect(range.gte).toEqual(WEDNESDAY);
    expect(range.lte).toBeUndefined();
    expect(range.lt).toBeUndefined();
  });

  // These windows are measured in calendar days via setDate, not in fixed
  // 24-hour spans, so the upper bound is asserted on the local date it lands on
  // rather than on an absolute instant - a 60-day window from October crosses
  // the end of daylight saving and would otherwise look an hour off.
  it("bounds 'upcoming' to the next 60 calendar days", () => {
    const range = getAvailabilityRange("upcoming", WEDNESDAY);

    expect(range.gte).toEqual(WEDNESDAY);
    expect(range.lte?.getMonth()).toBe(11);
    expect(range.lte?.getDate()).toBe(13);
  });

  it("bounds 'week' to the next 7 calendar days", () => {
    const range = getAvailabilityRange("week", WEDNESDAY);

    expect(range.gte).toEqual(WEDNESDAY);
    expect(range.lte?.getMonth()).toBe(9);
    expect(range.lte?.getDate()).toBe(21);
  });

  it("starts 'today' now rather than at midnight", () => {
    const range = getAvailabilityRange("today", WEDNESDAY);

    expect(range.gte).toEqual(WEDNESDAY);
    expect(range.lte?.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
  });

  it("keeps the weekend window in the future midweek", () => {
    const range = getAvailabilityRange("weekend", WEDNESDAY);

    expect(range.gte.getTime()).toBeGreaterThan(WEDNESDAY.getTime());
    expect(range.lt?.getTime()).toBeGreaterThan(range.gte.getTime());
  });

  it("clamps the weekend window to now when viewed during the weekend", () => {
    const range = getAvailabilityRange("weekend", SATURDAY);

    // Saturday's window opens at midnight, which is hours in the past by the
    // afternoon. Without the clamp this listed runs that had already finished.
    expect(range.gte).toEqual(SATURDAY);
    expect(range.lt?.getTime()).toBeGreaterThan(SATURDAY.getTime());
  });

  it("never returns a lower bound before now, for any option", () => {
    const options: AvailabilityFilter[] = [
      "upcoming",
      "today",
      "tonight",
      "week",
      "weekend",
      "any",
    ];

    for (const now of [WEDNESDAY, SATURDAY]) {
      for (const option of options) {
        expect(
          getAvailabilityRange(option, now).gte.getTime(),
        ).toBeGreaterThanOrEqual(now.getTime());
      }
    }
  });
});
