import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatFullDate,
  formatRunLength,
  splitClockTime,
} from "./formatters";

const span = (minutes: number) => [
  new Date("2026-10-24T14:00:00Z"),
  new Date(new Date("2026-10-24T14:00:00Z").getTime() + minutes * 60000),
] as const;

describe("formatDuration", () => {
  it("reports minutes under an hour", () => {
    expect(formatDuration(...span(45))).toBe("45 min");
  });

  it("drops the minutes when a run is a whole number of hours", () => {
    expect(formatDuration(...span(60))).toBe("1 hr");
    expect(formatDuration(...span(120))).toBe("2 hr");
  });

  it("reports both parts otherwise", () => {
    expect(formatDuration(...span(90))).toBe("1 hr 30 min");
  });

  // Imported data decides these timestamps, so a row with end before start is
  // a question of what to print, not whether it can happen.
  it("does not produce a negative duration", () => {
    expect(formatDuration(...span(-30))).toBe("0 min");
  });
});

describe("splitClockTime", () => {
  it("splits the time from its meridiem", () => {
    // 15:30 UTC is 11:30 in Toronto on this date.
    expect(splitClockTime(new Date("2026-10-26T15:30:00Z"))).toEqual({
      time: "11:30",
      unit: "a.m.",
    });
  });

  it("handles the afternoon", () => {
    expect(splitClockTime(new Date("2026-10-26T17:00:00Z"))).toEqual({
      time: "1:00",
      unit: "p.m.",
    });
  });
});

describe("formatRunLength", () => {
  const from = (minutes: number) => [
    new Date("2026-10-26T15:00:00Z"),
    new Date(new Date("2026-10-26T15:00:00Z").getTime() + minutes * 60000),
  ] as const;

  it("keeps anything under an hour in minutes", () => {
    expect(formatRunLength(...from(45))).toEqual({ value: "45", unit: "min" });
  });

  it("uses the singular for exactly one hour", () => {
    expect(formatRunLength(...from(60))).toEqual({ value: "1", unit: "hr" });
  });

  it("renders a half hour as a decimal", () => {
    expect(formatRunLength(...from(90))).toEqual({ value: "1.5", unit: "hrs" });
  });

  // Imported times are not always tidy, and "1.4833 hrs" would be noise.
  it("rounds to one decimal", () => {
    expect(formatRunLength(...from(89))).toEqual({ value: "1.5", unit: "hrs" });
  });

  it("drops a trailing zero", () => {
    expect(formatRunLength(...from(120))).toEqual({ value: "2", unit: "hrs" });
  });
});

describe("formatFullDate", () => {
  it("gives the weekday, month and day", () => {
    expect(formatFullDate(new Date("2026-10-26T15:30:00Z"))).toBe(
      "Monday, October 26",
    );
  });
});
