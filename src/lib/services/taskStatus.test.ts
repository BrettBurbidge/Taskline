import { describe, it, expect } from "vitest";
import { resolveCompletedAt } from "./taskStatus";

const NOW = new Date("2026-06-20T12:00:00Z");
const EARLIER = new Date("2026-06-01T09:00:00Z");

describe("resolveCompletedAt", () => {
  it("stamps now when a task becomes completed", () => {
    expect(
      resolveCompletedAt({
        nextStatus: "completed",
        currentCompletedAt: null,
        now: NOW,
      })
    ).toEqual(NOW);
  });

  it("keeps the original timestamp when re-saving an already-completed task", () => {
    // Re-saving must not rewrite when the work actually finished
    expect(
      resolveCompletedAt({
        nextStatus: "completed",
        currentCompletedAt: EARLIER,
        now: NOW,
      })
    ).toEqual(EARLIER);
  });

  it("clears the timestamp when a task is reopened", () => {
    for (const status of ["not_started", "in_progress", "waiting", "cancelled"]) {
      expect(
        resolveCompletedAt({
          nextStatus: status,
          currentCompletedAt: EARLIER,
          now: NOW,
        })
      ).toBeNull();
    }
  });

  it("leaves the column alone when no status is being written", () => {
    // A PATCH that only changes the title must not touch completedAt
    expect(
      resolveCompletedAt({
        nextStatus: undefined,
        currentCompletedAt: EARLIER,
        now: NOW,
      })
    ).toBeUndefined();
  });

  it("honours an explicit completedAt from the caller", () => {
    const historical = "2026-01-15T08:00:00Z";
    expect(
      resolveCompletedAt({
        nextStatus: "completed",
        currentCompletedAt: null,
        explicitCompletedAt: historical,
        now: NOW,
      })
    ).toEqual(new Date(historical));
  });

  it("ignores a null explicit value and falls back to status", () => {
    expect(
      resolveCompletedAt({
        nextStatus: "completed",
        currentCompletedAt: null,
        explicitCompletedAt: null,
        now: NOW,
      })
    ).toEqual(NOW);
  });
});
