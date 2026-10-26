import { describe, expect, it } from "vitest";
import { formatDuration } from "./formatters";

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
