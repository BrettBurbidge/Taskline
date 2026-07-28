/**
 * Analytics capture for tasks.
 *
 * These are pure functions that return the extra columns to merge into a Prisma
 * `data` payload. They exist because four separate paths mutate `dueAt`
 * (rollover, board move / week-view drag, the edit form, and two PATCH
 * endpoints) and they have drifted apart before — that is precisely what caused
 * the `completedAt` bug fixed in the punctuality work. Routing every mutation
 * through one place keeps the counters honest.
 *
 * Nothing here is populated by hand: the numbers accrue from actions the user
 * already takes.
 */

import { utcToDateString } from '$lib/utils/timezone';

/** The columns a caller must already have loaded to update the counters. */
export interface DueDateAnalyticsState {
  dueAt: Date | string | null;
  originalDueAt: Date | string | null;
  dueAtChangeCount: number;
}

export interface BoardDateAnalyticsState {
  boardDate: Date | string | null;
  firstBoardDate: Date | string | null;
  boardDayCount: number;
}

/** Partial Prisma payloads — spread into the `data` of a task update. */
export interface DueDateAnalyticsUpdate {
  originalDueAt?: Date;
  dueAtChangeCount?: number;
}

export interface BoardDateAnalyticsUpdate {
  firstBoardDate?: Date;
  boardDayCount?: number;
}

/**
 * Columns this module owns. PATCH endpoints spread the caller's body straight
 * into Prisma, so strip these first — a client (or the MCP) writing them
 * directly would silently corrupt the counters they're meant to guarantee.
 */
export function stripManagedAnalyticsFields<T extends Record<string, unknown>>(
  data: T
): Omit<T, 'originalDueAt' | 'dueAtChangeCount' | 'firstBoardDate' | 'boardDayCount'> {
  const {
    originalDueAt: _originalDueAt,
    dueAtChangeCount: _dueAtChangeCount,
    firstBoardDate: _firstBoardDate,
    boardDayCount: _boardDayCount,
    ...rest
  } = data;
  return rest;
}

/** Same calendar day in the user's timezone? Nulls are only equal to nulls. */
function sameDay(
  a: Date | string | null,
  b: Date | string | null,
  timezone?: string
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return utcToDateString(a, timezone) === utcToDateString(b, timezone);
}

/**
 * Track a due-date write.
 *
 * - The first time a task is given a due date, that date is stamped as
 *   `originalDueAt` and the change count stays at 0 — setting a date for the
 *   first time is not a reschedule.
 * - Only a move to a *different calendar day* increments the count, so re-saving
 *   the edit form without touching the date can't inflate it.
 * - Clearing the due date never erases `originalDueAt`; the original commitment
 *   still happened.
 *
 * Returns {} when there is nothing to change.
 */
export function applyDueDateChange(
  current: DueDateAnalyticsState,
  nextDueAt: Date | string | null,
  timezone?: string
): DueDateAnalyticsUpdate {
  const update: DueDateAnalyticsUpdate = {};

  // First due date this task has ever had — the baseline, not a reschedule.
  if (!current.originalDueAt && nextDueAt) {
    update.originalDueAt = new Date(nextDueAt);

    // Nothing to compare against if it also had no previous date.
    if (!current.dueAt) return update;
  }

  if (!sameDay(current.dueAt, nextDueAt, timezone)) {
    update.dueAtChangeCount = (current.dueAtChangeCount ?? 0) + 1;
  }

  return update;
}

/**
 * Track a board-date write. Landing on a board day the task hasn't occupied
 * before increments `boardDayCount`; re-writing the same day is a no-op, so
 * repeated saves and same-day rollovers don't inflate it.
 */
export function applyBoardDateChange(
  current: BoardDateAnalyticsState,
  nextBoardDate: Date | string | null,
  timezone?: string
): BoardDateAnalyticsUpdate {
  const update: BoardDateAnalyticsUpdate = {};

  if (!nextBoardDate) return update;

  if (!current.firstBoardDate) {
    update.firstBoardDate = new Date(nextBoardDate);
  }

  if (!sameDay(current.boardDate, nextBoardDate, timezone)) {
    update.boardDayCount = (current.boardDayCount ?? 0) + 1;
  }

  return update;
}

/**
 * How far the due date has slipped from the original commitment, in calendar
 * days. Positive = pushed later. null when there's no recorded original (tasks
 * that predate this tracking) or no current due date.
 */
export function slipVsOriginal(
  task: { dueAt: Date | string | null; originalDueAt: Date | string | null },
  timezone?: string
): number | null {
  if (!task.dueAt || !task.originalDueAt) return null;

  const original = utcToDateString(task.originalDueAt, timezone);
  const current = utcToDateString(task.dueAt, timezone);
  if (!original || !current) return null;

  return Math.round(
    (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${original}T00:00:00Z`)) / 86_400_000
  );
}
