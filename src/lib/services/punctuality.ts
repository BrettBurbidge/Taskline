/**
 * Punctuality analytics — how far from its due date a task actually gets closed.
 *
 * Shared by the dashboard (client-side, real browser timezone) and
 * GET /api/v1/reports/punctuality (server-side, DEFAULT_TIMEZONE) so the two can
 * never disagree.
 *
 * Everything is measured in whole CALENDAR days in the user's timezone, not in
 * elapsed hours: a task due Monday and finished Monday at 11pm is on time (0),
 * not 0.96 days late.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { utcToDateString } from '$lib/utils/timezone';

/** The minimal shape needed — both callers can pass their query results as-is. */
export interface PunctualityTask {
  status: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface PunctualitySummary {
  /** Completed tasks that had both a due date and a completion timestamp. */
  scored: number;
  /** Completed tasks we could not score (no due date, or no completedAt). */
  unscoreable: number;
  early: number;
  onTime: number;
  late: number;
  /** Positive = late, negative = early. null when nothing could be scored. */
  medianDays: number | null;
  meanDays: number | null;
  /** Most negative (earliest) and most positive (latest) deltas. */
  bestDays: number | null;
  worstDays: number | null;
}

/**
 * Calendar days between a task's due date and when it was actually completed.
 *
 * Positive = late, 0 = on time, negative = early.
 * Returns null when either date is missing (the task can't be scored).
 */
export function daysFromDue(
  dueAt: Date | string | null,
  completedAt: Date | string | null,
  timezone?: string
): number | null {
  if (!dueAt || !completedAt) return null;

  const dueDay = utcToDateString(dueAt, timezone);
  const doneDay = utcToDateString(completedAt, timezone);
  if (!dueDay || !doneDay) return null;

  return differenceInCalendarDays(parseISO(doneDay), parseISO(dueDay));
}

/**
 * How many calendar days a still-open task is past its due date.
 * Returns 0 when the task isn't due yet, or has no due date.
 */
export function daysOverdue(
  dueAt: Date | string | null,
  timezone?: string,
  asOf: Date = new Date()
): number {
  if (!dueAt) return 0;

  const dueDay = utcToDateString(dueAt, timezone);
  const today = utcToDateString(asOf, timezone);
  if (!dueDay || !today) return 0;

  const diff = differenceInCalendarDays(parseISO(today), parseISO(dueDay));
  return diff > 0 ? diff : 0;
}

/**
 * Aggregate closing punctuality across a set of tasks.
 *
 * Only tasks with status 'completed' are considered.
 *
 * `windowDays` limits to tasks completed within the last N calendar days
 * (inclusive — a task completed exactly N days ago still counts). Tasks with no
 * completedAt can't be placed in time, so they drop out entirely when a window
 * is active rather than being counted as unscoreable.
 */
export function summarizePunctuality(
  tasks: PunctualityTask[],
  timezone?: string,
  windowDays?: number,
  asOf: Date = new Date()
): PunctualitySummary {
  const empty: PunctualitySummary = {
    scored: 0,
    unscoreable: 0,
    early: 0,
    onTime: 0,
    late: 0,
    medianDays: null,
    meanDays: null,
    bestDays: null,
    worstDays: null,
  };

  let candidates = tasks.filter((t) => t.status === 'completed');

  if (windowDays !== undefined) {
    const today = utcToDateString(asOf, timezone);
    candidates = candidates.filter((t) => {
      if (!t.completedAt) return false;
      const doneDay = utcToDateString(t.completedAt, timezone);
      if (!doneDay) return false;
      const age = differenceInCalendarDays(parseISO(today), parseISO(doneDay));
      return age <= windowDays;
    });
  }

  if (candidates.length === 0) return empty;

  const deltas: number[] = [];
  let unscoreable = 0;

  for (const task of candidates) {
    const delta = daysFromDue(task.dueAt, task.completedAt, timezone);
    if (delta === null) {
      unscoreable += 1;
    } else {
      deltas.push(delta);
    }
  }

  if (deltas.length === 0) {
    return { ...empty, unscoreable };
  }

  const sorted = [...deltas].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianDays =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    scored: deltas.length,
    unscoreable,
    early: deltas.filter((d) => d < 0).length,
    onTime: deltas.filter((d) => d === 0).length,
    late: deltas.filter((d) => d > 0).length,
    medianDays,
    meanDays: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    bestDays: sorted[0],
    worstDays: sorted[sorted.length - 1],
  };
}

/**
 * Phrase a delta for display. Never renders a negative number of days late.
 *
 * formatDelta(13)   -> "13 days late"
 * formatDelta(-3)   -> "3 days early"
 * formatDelta(0)    -> "on time"
 */
export function formatDelta(days: number | null): string {
  if (days === null) return 'no data';

  const rounded = Math.round(Math.abs(days) * 10) / 10;
  if (rounded === 0) return 'on time';

  const unit = rounded === 1 ? 'day' : 'days';
  return days > 0 ? `${rounded} ${unit} late` : `${rounded} ${unit} early`;
}
