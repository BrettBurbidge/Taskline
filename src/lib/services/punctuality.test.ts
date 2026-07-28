import { describe, it, expect } from "vitest";
import {
  daysFromDue,
  daysOverdue,
  summarizePunctuality,
  formatDelta,
  type PunctualityTask,
} from "./punctuality";

const TZ = "America/Denver"; // UTC-7 (MST) / UTC-6 (MDT)

/** Build a completed task from YYYY-MM-DD strings, stored as UTC midnight. */
function completed(dueAt: string | null, completedAt: string | null): PunctualityTask {
  return {
    status: "completed",
    dueAt: dueAt ? new Date(`${dueAt}T12:00:00Z`) : null,
    completedAt: completedAt ? new Date(`${completedAt}T12:00:00Z`) : null,
  };
}

describe("daysFromDue", () => {
  it("returns a positive number when closed late", () => {
    expect(daysFromDue(new Date("2026-06-15T12:00:00Z"), new Date("2026-06-20T12:00:00Z"), TZ)).toBe(5);
  });

  it("returns 0 when closed on the due date", () => {
    expect(daysFromDue(new Date("2026-06-15T12:00:00Z"), new Date("2026-06-15T12:00:00Z"), TZ)).toBe(0);
  });

  it("returns a negative number when closed early", () => {
    expect(daysFromDue(new Date("2026-06-15T12:00:00Z"), new Date("2026-06-12T12:00:00Z"), TZ)).toBe(-3);
  });

  it("counts whole calendar days, not elapsed hours", () => {
    // Due Monday 00:00 local, finished Monday 23:00 local — that is ON TIME,
    // even though ~23 hours elapsed.
    const due = new Date("2026-06-15T06:00:00Z"); // Jun 15 00:00 MDT
    const done = new Date("2026-06-16T05:00:00Z"); // Jun 15 23:00 MDT
    expect(daysFromDue(due, done, TZ)).toBe(0);
  });

  it("rolls over at local midnight, not UTC midnight", () => {
    // 2026-06-16T05:00:00Z is still Jun 15 in Denver but already Jun 16 in UTC.
    const due = new Date("2026-06-15T06:00:00Z");
    const done = new Date("2026-06-16T05:00:00Z");
    expect(daysFromDue(due, done, TZ)).toBe(0);
    expect(daysFromDue(due, done, "UTC")).toBe(1);
  });

  it("survives a DST boundary", () => {
    // US DST starts Mar 8 2026. Mar 6 -> Mar 10 is 4 calendar days despite the
    // lost hour.
    const due = new Date("2026-03-06T12:00:00Z");
    const done = new Date("2026-03-10T12:00:00Z");
    expect(daysFromDue(due, done, TZ)).toBe(4);
  });

  it("returns null when either date is missing", () => {
    expect(daysFromDue(null, new Date(), TZ)).toBeNull();
    expect(daysFromDue(new Date(), null, TZ)).toBeNull();
    expect(daysFromDue(null, null, TZ)).toBeNull();
  });

  it("accepts ISO strings as well as Dates", () => {
    expect(daysFromDue("2026-06-15T12:00:00Z", "2026-06-18T12:00:00Z", TZ)).toBe(3);
  });
});

describe("daysOverdue", () => {
  const asOf = new Date("2026-06-20T12:00:00Z");

  it("counts days past the due date", () => {
    expect(daysOverdue(new Date("2026-06-15T12:00:00Z"), TZ, asOf)).toBe(5);
  });

  it("returns 0 on the due date itself", () => {
    expect(daysOverdue(new Date("2026-06-20T12:00:00Z"), TZ, asOf)).toBe(0);
  });

  it("returns 0 for a task not yet due", () => {
    expect(daysOverdue(new Date("2026-06-25T12:00:00Z"), TZ, asOf)).toBe(0);
  });

  it("returns 0 when there is no due date", () => {
    expect(daysOverdue(null, TZ, asOf)).toBe(0);
  });
});

describe("summarizePunctuality", () => {
  it("returns an empty summary for no tasks", () => {
    const s = summarizePunctuality([], TZ);
    expect(s.scored).toBe(0);
    expect(s.unscoreable).toBe(0);
    expect(s.medianDays).toBeNull();
    expect(s.meanDays).toBeNull();
    expect(s.bestDays).toBeNull();
    expect(s.worstDays).toBeNull();
  });

  it("ignores tasks that are not completed", () => {
    const tasks: PunctualityTask[] = [
      { status: "in_progress", dueAt: new Date("2026-06-01T12:00:00Z"), completedAt: null },
      { status: "not_started", dueAt: new Date("2026-06-01T12:00:00Z"), completedAt: null },
      { status: "cancelled", dueAt: new Date("2026-06-01T12:00:00Z"), completedAt: new Date("2026-06-09T12:00:00Z") },
    ];
    expect(summarizePunctuality(tasks, TZ).scored).toBe(0);
  });

  it("buckets early, on-time and late", () => {
    const s = summarizePunctuality(
      [
        completed("2026-06-15", "2026-06-12"), // -3 early
        completed("2026-06-15", "2026-06-15"), //  0 on time
        completed("2026-06-15", "2026-06-16"), // +1 late
        completed("2026-06-15", "2026-06-25"), // +10 late
      ],
      TZ
    );
    expect(s.early).toBe(1);
    expect(s.onTime).toBe(1);
    expect(s.late).toBe(2);
    expect(s.scored).toBe(4);
    expect(s.bestDays).toBe(-3);
    expect(s.worstDays).toBe(10);
  });

  it("counts completed tasks missing a date as unscoreable", () => {
    const s = summarizePunctuality(
      [
        completed("2026-06-15", "2026-06-20"), // +5, scored
        completed(null, "2026-06-20"), //          no due date
        completed("2026-06-15", null), //          never stamped completedAt
      ],
      TZ
    );
    expect(s.scored).toBe(1);
    expect(s.unscoreable).toBe(2);
    // The unscoreable ones must not drag the average
    expect(s.meanDays).toBe(5);
  });

  it("takes the middle value as median for odd counts", () => {
    const s = summarizePunctuality(
      [
        completed("2026-06-15", "2026-06-16"), // +1
        completed("2026-06-15", "2026-06-20"), // +5
        completed("2026-06-15", "2026-06-24"), // +9
      ],
      TZ
    );
    expect(s.medianDays).toBe(5);
  });

  it("averages the two middle values as median for even counts", () => {
    const s = summarizePunctuality(
      [
        completed("2026-06-15", "2026-06-16"), // +1
        completed("2026-06-15", "2026-06-19"), // +4
        completed("2026-06-15", "2026-06-20"), // +5
        completed("2026-06-15", "2026-06-24"), // +9
      ],
      TZ
    );
    expect(s.medianDays).toBe(4.5);
  });

  it("resists a single large outlier in the median", () => {
    // Shape of the real data: mostly late by ~13, one task 122 days late.
    const tasks = [
      ...Array.from({ length: 10 }, () => completed("2026-01-01", "2026-01-14")), // +13
      completed("2026-01-01", "2026-05-03"), // +122
    ];
    const s = summarizePunctuality(tasks, TZ);
    expect(s.medianDays).toBe(13);
    // The mean is dragged well above the typical case — the reason we headline median
    expect(s.meanDays).toBeGreaterThan(20);
    expect(s.worstDays).toBe(122);
  });

  it("filters to a recent window on completedAt", () => {
    const asOf = new Date("2026-06-30T12:00:00Z");
    const tasks = [
      completed("2026-06-20", "2026-06-25"), // 5 days ago
      completed("2026-01-01", "2026-01-10"), // ~half a year ago
    ];

    const all = summarizePunctuality(tasks, TZ, undefined, asOf);
    expect(all.scored).toBe(2);

    const recent = summarizePunctuality(tasks, TZ, 30, asOf);
    expect(recent.scored).toBe(1);
    expect(recent.medianDays).toBe(5);
  });

  it("includes a task completed exactly windowDays ago", () => {
    const asOf = new Date("2026-06-30T12:00:00Z");
    const tasks = [completed("2026-05-31", "2026-05-31")]; // exactly 30 days back
    expect(summarizePunctuality(tasks, TZ, 30, asOf).scored).toBe(1);
    expect(summarizePunctuality(tasks, TZ, 29, asOf).scored).toBe(0);
  });

  it("drops tasks with no completedAt when a window is active", () => {
    const asOf = new Date("2026-06-30T12:00:00Z");
    const tasks = [completed("2026-06-20", null)];
    // Can't be placed in time, so it isn't counted either way
    const windowed = summarizePunctuality(tasks, TZ, 30, asOf);
    expect(windowed.scored).toBe(0);
    expect(windowed.unscoreable).toBe(0);
    // Without a window it is reported as unscoreable
    expect(summarizePunctuality(tasks, TZ, undefined, asOf).unscoreable).toBe(1);
  });

  it("never divides by zero when nothing is scoreable", () => {
    const s = summarizePunctuality([completed(null, null)], TZ);
    expect(s.scored).toBe(0);
    expect(s.unscoreable).toBe(1);
    expect(s.meanDays).toBeNull();
    expect(s.medianDays).toBeNull();
  });
});

describe("formatDelta", () => {
  it("phrases late, early and on time without negative numbers", () => {
    expect(formatDelta(13)).toBe("13 days late");
    expect(formatDelta(-3)).toBe("3 days early");
    expect(formatDelta(0)).toBe("on time");
  });

  it("singularises one day", () => {
    expect(formatDelta(1)).toBe("1 day late");
    expect(formatDelta(-1)).toBe("1 day early");
  });

  it("rounds to one decimal place", () => {
    expect(formatDelta(17.68)).toBe("17.7 days late");
    expect(formatDelta(4.5)).toBe("4.5 days late");
  });

  it("treats a delta that rounds to zero as on time", () => {
    expect(formatDelta(0.02)).toBe("on time");
  });

  it("handles no data", () => {
    expect(formatDelta(null)).toBe("no data");
  });
});
