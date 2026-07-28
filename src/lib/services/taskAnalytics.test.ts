import { describe, it, expect } from "vitest";
import {
  applyDueDateChange,
  applyBoardDateChange,
  slipVsOriginal,
  rankMostPushed,
  type PushedTask,
} from "./taskAnalytics";

const TZ = "America/Denver";

const d = (iso: string) => new Date(iso);

describe("applyDueDateChange", () => {
  it("stamps originalDueAt the first time a due date is set, without counting it as a reschedule", () => {
    const update = applyDueDateChange(
      { dueAt: null, originalDueAt: null, dueAtChangeCount: 0 },
      d("2026-06-15T12:00:00Z"),
      TZ
    );
    expect(update.originalDueAt).toEqual(d("2026-06-15T12:00:00Z"));
    // Setting a date for the first time is not a push
    expect(update.dueAtChangeCount).toBeUndefined();
  });

  it("increments the count when the date moves to a different day", () => {
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-15T12:00:00Z"),
        originalDueAt: d("2026-06-15T12:00:00Z"),
        dueAtChangeCount: 0,
      },
      d("2026-06-22T12:00:00Z"),
      TZ
    );
    expect(update.dueAtChangeCount).toBe(1);
    // The original commitment must not be rewritten
    expect(update.originalDueAt).toBeUndefined();
  });

  it("keeps incrementing across repeated pushes", () => {
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-22T12:00:00Z"),
        originalDueAt: d("2026-06-15T12:00:00Z"),
        dueAtChangeCount: 3,
      },
      d("2026-06-29T12:00:00Z"),
      TZ
    );
    expect(update.dueAtChangeCount).toBe(4);
  });

  it("does not count a no-op save on the same day", () => {
    // Re-saving the edit form without touching the date must not inflate the count
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-15T06:00:00Z"), // Jun 15 00:00 MDT
        originalDueAt: d("2026-06-15T06:00:00Z"),
        dueAtChangeCount: 2,
      },
      d("2026-06-16T05:00:00Z"), // Jun 15 23:00 MDT — same local day
      TZ
    );
    expect(update.dueAtChangeCount).toBeUndefined();
  });

  it("counts a same-UTC-day change that crosses a local day boundary", () => {
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-15T06:00:00Z"), // Jun 15 in Denver
        originalDueAt: d("2026-06-15T06:00:00Z"),
        dueAtChangeCount: 0,
      },
      d("2026-06-16T07:00:00Z"), // Jun 16 in Denver
      TZ
    );
    expect(update.dueAtChangeCount).toBe(1);
  });

  it("never erases originalDueAt when the due date is cleared", () => {
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-15T12:00:00Z"),
        originalDueAt: d("2026-06-15T12:00:00Z"),
        dueAtChangeCount: 1,
      },
      null,
      TZ
    );
    expect(update.originalDueAt).toBeUndefined();
    expect(update.dueAtChangeCount).toBe(2);
  });

  it("stamps the original on a task that predates tracking, on its next change", () => {
    // Existing rows have originalDueAt = null; the first write we observe
    // becomes the baseline AND counts, since we know a date already existed.
    const update = applyDueDateChange(
      {
        dueAt: d("2026-06-15T12:00:00Z"),
        originalDueAt: null,
        dueAtChangeCount: 0,
      },
      d("2026-06-20T12:00:00Z"),
      TZ
    );
    expect(update.originalDueAt).toEqual(d("2026-06-20T12:00:00Z"));
    expect(update.dueAtChangeCount).toBe(1);
  });

  it("does nothing when both dates are absent", () => {
    expect(
      applyDueDateChange(
        { dueAt: null, originalDueAt: null, dueAtChangeCount: 0 },
        null,
        TZ
      )
    ).toEqual({});
  });
});

describe("applyBoardDateChange", () => {
  it("seeds firstBoardDate on the first board placement", () => {
    const update = applyBoardDateChange(
      { boardDate: null, firstBoardDate: null, boardDayCount: 0 },
      d("2026-06-15T12:00:00Z"),
      TZ
    );
    expect(update.firstBoardDate).toEqual(d("2026-06-15T12:00:00Z"));
    expect(update.boardDayCount).toBe(1);
  });

  it("increments when the task moves to a new board day", () => {
    const update = applyBoardDateChange(
      {
        boardDate: d("2026-06-15T12:00:00Z"),
        firstBoardDate: d("2026-06-10T12:00:00Z"),
        boardDayCount: 4,
      },
      d("2026-06-16T12:00:00Z"),
      TZ
    );
    expect(update.boardDayCount).toBe(5);
    expect(update.firstBoardDate).toBeUndefined();
  });

  it("is idempotent for a same-day write", () => {
    // A rollover run twice in one day must not double-count
    const update = applyBoardDateChange(
      {
        boardDate: d("2026-06-15T06:00:00Z"),
        firstBoardDate: d("2026-06-10T12:00:00Z"),
        boardDayCount: 4,
      },
      d("2026-06-16T05:00:00Z"), // still Jun 15 in Denver
      TZ
    );
    expect(update).toEqual({});
  });

  it("ignores a null board date", () => {
    expect(
      applyBoardDateChange(
        {
          boardDate: d("2026-06-15T12:00:00Z"),
          firstBoardDate: d("2026-06-15T12:00:00Z"),
          boardDayCount: 1,
        },
        null,
        TZ
      )
    ).toEqual({});
  });
});

describe("slipVsOriginal", () => {
  it("reports how far the date was pushed", () => {
    expect(
      slipVsOriginal(
        {
          originalDueAt: d("2026-06-15T12:00:00Z"),
          dueAt: d("2026-07-15T12:00:00Z"),
        },
        TZ
      )
    ).toBe(30);
  });

  it("returns 0 when the date never moved", () => {
    expect(
      slipVsOriginal(
        {
          originalDueAt: d("2026-06-15T12:00:00Z"),
          dueAt: d("2026-06-15T12:00:00Z"),
        },
        TZ
      )
    ).toBe(0);
  });

  it("can report a pull-in as negative", () => {
    expect(
      slipVsOriginal(
        {
          originalDueAt: d("2026-06-15T12:00:00Z"),
          dueAt: d("2026-06-10T12:00:00Z"),
        },
        TZ
      )
    ).toBe(-5);
  });

  it("returns null when history is unknown", () => {
    expect(
      slipVsOriginal({ originalDueAt: null, dueAt: d("2026-06-15T12:00:00Z") }, TZ)
    ).toBeNull();
    expect(
      slipVsOriginal({ originalDueAt: d("2026-06-15T12:00:00Z"), dueAt: null }, TZ)
    ).toBeNull();
  });
});

describe("rankMostPushed", () => {
  function pushed(overrides: Partial<PushedTask> = {}): PushedTask {
    return {
      id: "t1",
      title: "A task",
      status: "not_started",
      dueAt: null,
      originalDueAt: null,
      dueAtChangeCount: 0,
      boardDayCount: 1,
      ...overrides,
    };
  }

  it("excludes tasks that were never pushed", () => {
    expect(rankMostPushed([pushed()])).toEqual([]);
  });

  it("includes tasks pushed by due date or by living on multiple board days", () => {
    const ranks = rankMostPushed([
      pushed({ id: "a", dueAtChangeCount: 1 }),
      pushed({ id: "b", boardDayCount: 2 }),
    ]);
    expect(ranks.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes completed and cancelled tasks", () => {
    const ranks = rankMostPushed([
      pushed({ status: "completed", dueAtChangeCount: 5 }),
      pushed({ status: "cancelled", dueAtChangeCount: 5 }),
    ]);
    expect(ranks).toEqual([]);
  });

  it("orders by reschedule count, then board days", () => {
    const ranks = rankMostPushed([
      pushed({ id: "few", dueAtChangeCount: 1, boardDayCount: 9 }),
      pushed({ id: "many", dueAtChangeCount: 3, boardDayCount: 2 }),
      pushed({ id: "tie-more-days", dueAtChangeCount: 3, boardDayCount: 5 }),
    ]);
    expect(ranks.map((r) => r.id)).toEqual(["tie-more-days", "many", "few"]);
  });

  it("respects the limit", () => {
    const tasks = ["a", "b", "c"].map((id) => pushed({ id, dueAtChangeCount: 1 }));
    expect(rankMostPushed(tasks, { limit: 2 })).toHaveLength(2);
  });

  it("passes slip through from slipVsOriginal", () => {
    const [rank] = rankMostPushed(
      [
        pushed({
          dueAtChangeCount: 2,
          originalDueAt: d("2026-06-15T12:00:00Z"),
          dueAt: d("2026-06-22T12:00:00Z"),
        }),
      ],
      { timezone: TZ }
    );
    expect(rank.slipDays).toBe(7);
  });

  it("reports null slip when there is no original commitment", () => {
    const [rank] = rankMostPushed([pushed({ dueAtChangeCount: 1 })]);
    expect(rank.slipDays).toBeNull();
  });
});
