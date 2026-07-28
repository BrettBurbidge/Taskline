import { describe, it, expect } from "vitest";
import { recoverOriginalDueDate, type FollowUpRow } from "./recoverOriginalDueDate";

const TZ = "America/Denver";

/** A follow-up generated at `createdAt`, due on `dueAt`. */
const fu = (createdAt: string, dueAt: string): FollowUpRow => ({
  createdAt: new Date(createdAt),
  dueAt: new Date(dueAt),
});

describe("recoverOriginalDueDate", () => {
  it("recovers the due date when a batch clamps two follow-ups onto the same day", () => {
    // Two cadences both capped at the due date rather than landing past it
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:01Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:01Z", "2026-06-02T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "recovered", originalDay: "2026-06-05" });
  });

  it("reports no evidence when nothing clamped", () => {
    // Every follow-up on its own day — the due date was never reached
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00Z", "2026-06-08T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-15T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "no_evidence" });
  });

  it("reports no evidence for a single follow-up", () => {
    expect(
      recoverOriginalDueDate([fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z")], TZ)
    ).toEqual({ status: "no_evidence" });
  });

  it("reports no evidence when there are no follow-ups at all", () => {
    expect(recoverOriginalDueDate([], TZ)).toEqual({ status: "no_evidence" });
  });

  it("ignores later batches, which reflect post-reschedule dates", () => {
    // First batch clamps to Jun 5; a later regeneration clamps to Jun 20.
    // Only the original matters.
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-14T09:00:00Z", "2026-06-20T12:00:00Z"),
        fu("2026-06-14T09:00:00Z", "2026-06-20T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "recovered", originalDay: "2026-06-05" });
  });

  it("skips rather than guesses when a batch has two clamp candidates", () => {
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-09T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-09T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({
      status: "ambiguous",
      candidates: ["2026-06-05", "2026-06-09"],
    });
  });

  it("is not confused by unordered input", () => {
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-14T09:00:00Z", "2026-06-20T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-14T09:00:00Z", "2026-06-20T12:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-05T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "recovered", originalDay: "2026-06-05" });
  });

  it("groups by local calendar day, not UTC day", () => {
    // 2026-06-06T05:00:00Z is still Jun 5 in Denver. Both follow-ups are the
    // same local day, so this is a clamp; under UTC it would look like two days.
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00Z", "2026-06-05T18:00:00Z"),
        fu("2026-06-01T10:00:00Z", "2026-06-06T05:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "recovered", originalDay: "2026-06-05" });

    // Same input read in UTC spans two days and yields no clamp
    expect(
      recoverOriginalDueDate(
        [
          fu("2026-06-01T10:00:00Z", "2026-06-05T18:00:00Z"),
          fu("2026-06-01T10:00:00Z", "2026-06-06T05:00:00Z"),
        ],
        "UTC"
      )
    ).toEqual({ status: "no_evidence" });
  });

  it("treats follow-ups written moments apart as one batch", () => {
    // createMany rows can straddle a second boundary
    const result = recoverOriginalDueDate(
      [
        fu("2026-06-01T10:00:00.900Z", "2026-06-05T12:00:00Z"),
        fu("2026-06-01T10:00:02.100Z", "2026-06-05T12:00:00Z"),
      ],
      TZ
    );
    expect(result).toEqual({ status: "recovered", originalDay: "2026-06-05" });
  });
});
