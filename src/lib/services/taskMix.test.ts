import { describe, it, expect } from "vitest";
import {
  medianMinutesByType,
  summarizeTaskMix,
  formatMinutes,
  DEFAULT_ESTIMATED_MINUTES,
  TASK_TYPES,
  type TaskMixTask,
} from "./taskMix";

const TZ = "America/Denver"; // UTC-7 (MST) / UTC-6 (MDT)

/** Build a task; defaults to a completed, classified deep-work task. */
function mixTask(overrides: Partial<TaskMixTask> = {}): TaskMixTask {
  return {
    status: "completed",
    completedAt: new Date("2026-06-15T12:00:00Z"),
    taskType: "deep_work",
    estimatedMinutes: 60,
    priority: null,
    projectId: null,
    accountablePersonId: "p1",
    executorPersonId: null,
    ...overrides,
  };
}

/** Completed N days before the given asOf date (both at UTC noon). */
function completedDaysAgo(days: number, overrides: Partial<TaskMixTask> = {}): TaskMixTask {
  const completedAt = new Date(Date.parse("2026-06-30T12:00:00Z") - days * 86_400_000);
  return mixTask({ completedAt, ...overrides });
}

const AS_OF = new Date("2026-06-30T12:00:00Z");

describe("medianMinutesByType", () => {
  it("computes an odd-count median per type", () => {
    const { perType } = medianMinutesByType([
      mixTask({ estimatedMinutes: 10 }),
      mixTask({ estimatedMinutes: 60 }),
      mixTask({ estimatedMinutes: 90 }),
    ]);
    expect(perType.deep_work).toBe(60);
  });

  it("computes an even-count median per type", () => {
    const { perType } = medianMinutesByType([
      mixTask({ taskType: "admin", estimatedMinutes: 10 }),
      mixTask({ taskType: "admin", estimatedMinutes: 30 }),
    ]);
    expect(perType.admin).toBe(20);
  });

  it("computes the global median across types", () => {
    const { global } = medianMinutesByType([
      mixTask({ taskType: "admin", estimatedMinutes: 10 }),
      mixTask({ taskType: "deep_work", estimatedMinutes: 60 }),
      mixTask({ taskType: "meeting", estimatedMinutes: 90 }),
    ]);
    expect(global).toBe(60);
  });

  it("ignores null and non-positive estimates", () => {
    const { perType, global } = medianMinutesByType([
      mixTask({ estimatedMinutes: null }),
      mixTask({ estimatedMinutes: 0 }),
      mixTask({ estimatedMinutes: 45 }),
    ]);
    expect(perType.deep_work).toBe(45);
    expect(global).toBe(45);
  });

  it("returns empty results for empty input", () => {
    expect(medianMinutesByType([])).toEqual({ perType: {}, global: null });
  });
});

describe("summarizeTaskMix — minutes fallback", () => {
  it("uses the task's own estimate when present", () => {
    const summary = summarizeTaskMix([mixTask({ estimatedMinutes: 25 })], {
      population: "completed",
    });
    expect(summary.totalMinutes).toBe(25);
    expect(summary.withEstimate).toBe(1);
  });

  it("falls back to the per-type median", () => {
    const summary = summarizeTaskMix(
      [
        mixTask({ estimatedMinutes: 100 }),
        mixTask({ estimatedMinutes: 200 }),
        mixTask({ estimatedMinutes: null }), // borrows deep_work median 150
      ],
      { population: "completed" }
    );
    expect(summary.totalMinutes).toBe(450);
    expect(summary.withEstimate).toBe(2);
  });

  it("falls back to the global median when the type has no estimates", () => {
    const summary = summarizeTaskMix(
      [
        mixTask({ taskType: "meeting", estimatedMinutes: 40 }),
        mixTask({ taskType: "admin", estimatedMinutes: null }), // borrows global 40
      ],
      { population: "completed" }
    );
    expect(summary.slices.find((s) => s.key === "admin")!.minutes).toBe(40);
  });

  it("falls back to the default constant when nothing has an estimate", () => {
    const summary = summarizeTaskMix([mixTask({ estimatedMinutes: null })], {
      population: "completed",
    });
    expect(summary.totalMinutes).toBe(DEFAULT_ESTIMATED_MINUTES);
    expect(summary.withEstimate).toBe(0);
  });

  it("draws fallback medians from outside the window and population", () => {
    const summary = summarizeTaskMix(
      [
        // Old completed task, outside the 30-day window — still feeds the median.
        completedDaysAgo(200, { estimatedMinutes: 90 }),
        // Open task — other population — still feeds the median.
        mixTask({ status: "not_started", completedAt: null, estimatedMinutes: 90 }),
        // In-window task with no estimate: borrows 90, not the default 30.
        completedDaysAgo(5, { estimatedMinutes: null }),
      ],
      { population: "completed", timezone: TZ, windowDays: 30, asOf: AS_OF }
    );
    expect(summary.total).toBe(1);
    expect(summary.totalMinutes).toBe(90);
  });
});

describe("summarizeTaskMix — mix math", () => {
  it("splits percentages by count and by time independently", () => {
    const summary = summarizeTaskMix(
      [
        mixTask({ taskType: "deep_work", estimatedMinutes: 180 }),
        mixTask({ taskType: "admin", estimatedMinutes: 20 }),
      ],
      { population: "completed" }
    );
    const deep = summary.slices.find((s) => s.key === "deep_work")!;
    const admin = summary.slices.find((s) => s.key === "admin")!;
    expect(deep.pctByCount).toBe(50);
    expect(admin.pctByCount).toBe(50);
    expect(deep.pctByTime).toBe(90);
    expect(admin.pctByTime).toBe(10);
  });

  it("always returns all seven slices in fixed order", () => {
    const summary = summarizeTaskMix([mixTask()], { population: "completed" });
    expect(summary.slices.map((s) => s.key)).toEqual([...TASK_TYPES, "unclassified"]);
    expect(summary.slices.filter((s) => s.count === 0)).toHaveLength(6);
  });

  it("buckets null and unknown taskTypes as unclassified", () => {
    const summary = summarizeTaskMix(
      [mixTask({ taskType: null }), mixTask({ taskType: "garbage_value" })],
      { population: "completed" }
    );
    expect(summary.unclassified).toBe(2);
    expect(summary.unclassifiedPct).toBe(100);
  });
});

describe("summarizeTaskMix — windowing", () => {
  it("includes a task completed exactly windowDays ago (inclusive)", () => {
    const summary = summarizeTaskMix([completedDaysAgo(30)], {
      population: "completed",
      timezone: TZ,
      windowDays: 30,
      asOf: AS_OF,
    });
    expect(summary.total).toBe(1);
  });

  it("excludes tasks older than the window", () => {
    const summary = summarizeTaskMix([completedDaysAgo(31)], {
      population: "completed",
      timezone: TZ,
      windowDays: 30,
      asOf: AS_OF,
    });
    expect(summary.total).toBe(0);
  });

  it("drops completed tasks without completedAt only when a window is active", () => {
    const tasks = [mixTask({ completedAt: null })];
    expect(
      summarizeTaskMix(tasks, { population: "completed", windowDays: 30, asOf: AS_OF }).total
    ).toBe(0);
    expect(summarizeTaskMix(tasks, { population: "completed" }).total).toBe(1);
  });

  it("windows on local calendar days, not UTC", () => {
    // 2026-06-24T05:00:00Z is still Jun 23 in Denver: 7 days before Jun 30,
    // outside a 6-day window in Denver but inside it in UTC.
    const task = mixTask({ completedAt: new Date("2026-06-24T05:00:00Z") });
    const opts = { population: "completed" as const, windowDays: 6, asOf: AS_OF };
    expect(summarizeTaskMix([task], { ...opts, timezone: TZ }).total).toBe(0);
    expect(summarizeTaskMix([task], { ...opts, timezone: "UTC" }).total).toBe(1);
  });
});

describe("summarizeTaskMix — populations", () => {
  const roster = [
    mixTask({ status: "not_started", completedAt: null }),
    mixTask({ status: "in_progress", completedAt: null }),
    mixTask({ status: "waiting", completedAt: null }),
    mixTask({ status: "completed" }),
    mixTask({ status: "cancelled", completedAt: null }),
  ];

  it("open = not_started + in_progress + waiting", () => {
    expect(summarizeTaskMix(roster, { population: "open" }).total).toBe(3);
  });

  it("completed population is only completed tasks", () => {
    expect(summarizeTaskMix(roster, { population: "completed" }).total).toBe(1);
  });

  it("cancelled tasks never count in either population", () => {
    const summary = summarizeTaskMix([mixTask({ status: "cancelled" })], {
      population: "completed",
    });
    expect(summary.total).toBe(0);
  });

  it("ignores windowDays for the open population", () => {
    const summary = summarizeTaskMix(
      [mixTask({ status: "not_started", completedAt: null })],
      { population: "open", timezone: TZ, windowDays: 30, asOf: AS_OF }
    );
    expect(summary.total).toBe(1);
  });
});

describe("summarizeTaskMix — leverage rollup", () => {
  it("maps types into deep_work / coordination / overhead / neutral", () => {
    const summary = summarizeTaskMix(
      [
        mixTask({ taskType: "deep_work" }),
        mixTask({ taskType: "meeting" }),
        mixTask({ taskType: "followup" }),
        mixTask({ taskType: "admin" }),
        mixTask({ taskType: "errand" }),
        mixTask({ taskType: "other" }),
        mixTask({ taskType: null }),
      ],
      { population: "completed" }
    );
    const byKey = Object.fromEntries(summary.leverage.map((b) => [b.key, b.count]));
    expect(byKey).toEqual({ deep_work: 1, coordination: 2, overhead: 2, neutral: 2 });
  });

  it("bucket percentages sum to 100", () => {
    const summary = summarizeTaskMix(
      [mixTask(), mixTask({ taskType: "admin" }), mixTask({ taskType: "meeting" })],
      { population: "completed" }
    );
    const sum = summary.leverage.reduce((acc, b) => acc + b.pctByCount, 0);
    expect(sum).toBeCloseTo(100);
  });
});

describe("summarizeTaskMix — indicators", () => {
  it("counts delegation only when executor differs from accountable", () => {
    const summary = summarizeTaskMix(
      [
        mixTask({ executorPersonId: "p2" }), // delegated
        mixTask({ executorPersonId: "p1" }), // self-executed
        mixTask({ executorPersonId: null }), // no executor
      ],
      { population: "completed" }
    );
    expect(summary.indicators.delegated).toBe(1);
    expect(summary.indicators.delegatedPct).toBeCloseTo(100 / 3);
  });

  it("counts only priority === 'high' as high priority", () => {
    const summary = summarizeTaskMix(
      [mixTask({ priority: "high" }), mixTask({ priority: "medium" }), mixTask()],
      { population: "completed" }
    );
    expect(summary.indicators.highPriority).toBe(1);
  });

  it("counts project-linked tasks", () => {
    const summary = summarizeTaskMix(
      [mixTask({ projectId: "proj1" }), mixTask()],
      { population: "completed" }
    );
    expect(summary.indicators.projectLinked).toBe(1);
    expect(summary.indicators.projectLinkedPct).toBe(50);
  });
});

describe("summarizeTaskMix — empty input", () => {
  it("returns zeros everywhere, never NaN", () => {
    const summary = summarizeTaskMix([], { population: "completed" });
    expect(summary.total).toBe(0);
    expect(summary.totalMinutes).toBe(0);
    expect(summary.unclassifiedPct).toBe(0);
    for (const slice of summary.slices) {
      expect(slice.pctByCount).toBe(0);
      expect(slice.pctByTime).toBe(0);
    }
    for (const bucket of summary.leverage) {
      expect(bucket.pctByCount).toBe(0);
    }
    expect(summary.indicators.delegatedPct).toBe(0);
  });
});

describe("formatMinutes", () => {
  it("formats sub-hour values as minutes", () => {
    expect(formatMinutes(45)).toBe("45m");
  });

  it("formats mixed values as hours and minutes", () => {
    expect(formatMinutes(200)).toBe("3h 20m");
  });

  it("formats whole hours without minutes", () => {
    expect(formatMinutes(720)).toBe("12h");
  });

  it("formats zero as 0m", () => {
    expect(formatMinutes(0)).toBe("0m");
  });
});
