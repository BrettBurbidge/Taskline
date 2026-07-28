/**
 * Task activity log.
 *
 * The `task_activity` table has existed (and been migrated) since the start, and
 * its schema documents `created`, `status_changed`, `due_date_changed`,
 * `completed`, `note_added` — but only `followup_completed` was ever written, so
 * the timeline UI renders branches that never fire. These helpers fill it in.
 *
 * Logging is best-effort: an activity write must never fail the task write it
 * describes. Same defensive posture as `generateForTask` in the route handlers.
 */

import type { Prisma } from '@prisma/client';
import { db } from '$lib/db';
import { formatDateInUserTZ } from '$lib/utils/timezone';

/** The activityType values the schema documents. */
export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'due_date_changed'
  | 'board_date_changed'
  | 'completed'
  | 'followup_completed'
  | 'note_added';

async function record(
  taskId: string,
  activityType: ActivityType,
  description: string,
  metadata?: Prisma.InputJsonObject
): Promise<void> {
  try {
    await db.taskActivity.create({
      data: { taskId, activityType, description, metadata: metadata ?? undefined },
    });
  } catch (err) {
    // Never let bookkeeping break the operation it is describing
    console.error(`Failed to record ${activityType} activity for task ${taskId}:`, err);
  }
}

function dayLabel(date: Date | string | null, timezone?: string): string {
  return date ? formatDateInUserTZ(date, 'MMM d, yyyy', timezone) : 'no date';
}

export async function recordCreated(taskId: string, title: string): Promise<void> {
  await record(taskId, 'created', `Task created: ${title}`, { title });
}

export async function recordCompleted(taskId: string): Promise<void> {
  await record(taskId, 'completed', 'Task completed');
}

/**
 * `source` records which path moved the date — rollover pushes are invisible to
 * the user, so being able to separate them from deliberate reschedules is the
 * whole point of tracking this.
 */
export async function recordDueDateChanged(
  taskId: string,
  from: Date | string | null,
  to: Date | string | null,
  source: 'rollover' | 'board_move' | 'edit_form' | 'api',
  timezone?: string
): Promise<void> {
  await record(
    taskId,
    'due_date_changed',
    `Due date changed from ${dayLabel(from, timezone)} to ${dayLabel(to, timezone)}`,
    {
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to).toISOString() : null,
      source,
    }
  );
}

export async function recordBoardDateChanged(
  taskId: string,
  from: Date | string | null,
  to: Date | string | null,
  source: 'rollover' | 'board_move' | 'api',
  timezone?: string
): Promise<void> {
  await record(
    taskId,
    'board_date_changed',
    `Moved on the board from ${dayLabel(from, timezone)} to ${dayLabel(to, timezone)}`,
    {
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to).toISOString() : null,
      source,
    }
  );
}

export async function recordStatusChanged(
  taskId: string,
  from: string,
  to: string
): Promise<void> {
  if (from === to) return;

  if (to === 'completed') {
    await record(taskId, 'completed', 'Task completed', { from, to });
    return;
  }

  await record(
    taskId,
    'status_changed',
    `Status changed from ${from.replace('_', ' ')} to ${to.replace('_', ' ')}`,
    { from, to }
  );
}
