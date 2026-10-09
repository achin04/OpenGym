import { describe, expect, it } from "vitest";
import { SourceRunStatus } from "@/generated/prisma/enums";
import { sourceStatusNotice } from "./source-status";

describe("sourceStatusNotice", () => {
  it("returns no notice for an active run", () => {
    expect(
      sourceStatusNotice(SourceRunStatus.ACTIVE, "City of Toronto"),
    ).toBeNull();
  });

  it("returns no notice for a stale run, which nothing sets yet", () => {
    expect(
      sourceStatusNotice(SourceRunStatus.STALE, "City of Toronto"),
    ).toBeNull();
  });

  it("names the source in the notice for a removed run", () => {
    const notice = sourceStatusNotice(
      SourceRunStatus.REMOVED,
      "City of Toronto",
    );

    expect(notice?.heading).toBe("No longer listed by City of Toronto");
    expect(notice?.body).not.toBe("");
  });

  it("does not name the source for a cancelled run", () => {
    const notice = sourceStatusNotice(
      SourceRunStatus.CANCELLED,
      "City of Toronto",
    );

    expect(notice).not.toBeNull();
    expect(notice?.heading).not.toContain("City of Toronto");
  });
});
