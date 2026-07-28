/**
 * Recovering a task's original due date from its follow-up history.
 *
 * `generateForTask` only deletes *pending, future* follow-ups, so older rows
 * survive every reschedule. And getNextFollowUpDate clamps to the due date:
 *
 *     if (nextDate > new Date(dueDate)) return new Date(dueDate);
 *
 * So when two or more follow-ups from a single generation batch land on the same
 * day, that day IS the task's due date at the moment the batch was written. Read
 * off the *earliest* batch, that is the original due date — a recovered fact,
 * not an estimate.
 *
 * Anything short of that proof is reported as unrecoverable rather than guessed:
 * writing an approximation into `originalDueAt` would put an estimate in a
 * column every downstream reader treats as fact.
 */

import { utcToDateString } from '$lib/utils/timezone';

export interface FollowUpRow {
  dueAt: Date | string;
  createdAt: Date | string;
}

export type RecoveryResult =
  | { status: 'recovered'; originalDay: string }
  /** No follow-ups, or no day repeated within the first batch — no clamp happened. */
  | { status: 'no_evidence' }
  /** More than one candidate day; a single batch clamps to one date, so this is unexplained. */
  | { status: 'ambiguous'; candidates: string[] };

/** Follow-ups written by one `createMany` share a timestamp to within a moment. */
const BATCH_WINDOW_MS = 5_000;

/**
 * Infer the task's original due date from its follow-ups.
 *
 * Pure and database-free so it can be unit tested; the script wraps it.
 */
export function recoverOriginalDueDate(
  followUps: FollowUpRow[],
  timezone?: string
): RecoveryResult {
  if (followUps.length === 0) return { status: 'no_evidence' };

  const sorted = [...followUps].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // The earliest generation batch — later batches reflect due dates the task had
  // *after* it was already rescheduled, which is not what we're looking for.
  const firstCreatedAt = new Date(sorted[0].createdAt).getTime();
  const batch = sorted.filter(
    (f) => new Date(f.createdAt).getTime() - firstCreatedAt < BATCH_WINDOW_MS
  );

  const dayCounts = new Map<string, number>();
  for (const followUp of batch) {
    const day = utcToDateString(followUp.dueAt, timezone);
    if (!day) continue;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  // A day hit more than once is the clamp: several cadences all capped at the
  // due date rather than landing past it.
  const candidates = [...dayCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([day]) => day)
    .sort();

  if (candidates.length === 0) return { status: 'no_evidence' };
  if (candidates.length > 1) return { status: 'ambiguous', candidates };

  return { status: 'recovered', originalDay: candidates[0] };
}
