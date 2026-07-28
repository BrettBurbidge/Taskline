import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import { dateStringToUTC } from '$lib/utils/timezone';
import { applyDueDateChange, applyBoardDateChange } from '$lib/services/taskAnalytics';
import { recordDueDateChanged, recordBoardDateChanged } from '$lib/services/taskActivity';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/move - move task to a different board date
export const POST: RequestHandler = async ({ params, request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const { boardDate, timezone } = await request.json();

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  // Parse board date using timezone utilities
  let parsedBoardDate: Date | null = null;
  if (boardDate) {
    parsedBoardDate = dateStringToUTC(boardDate, tz);
  }

  // Load the counters before mutating so the reschedule can be recorded
  const existing = await db.task.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      dueAt: true,
      boardDate: true,
      originalDueAt: true,
      dueAtChangeCount: true,
      firstBoardDate: true,
      boardDayCount: true,
    },
  });

  if (!existing) {
    throw error(404, 'Task not found or access denied');
  }

  const task = await db.task.update({
    where: {
      id: params.id,
      userId, // Verify ownership
    },
    data: {
      boardDate: parsedBoardDate,
      dueAt: parsedBoardDate,
      sortOrder: null, // Reset sort order when moving
      ...applyBoardDateChange(existing, parsedBoardDate, tz),
      ...applyDueDateChange(existing, parsedBoardDate, tz),
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: { person: true },
      },
    },
  });

  await recordBoardDateChanged(task.id, existing.boardDate, parsedBoardDate, 'board_move', tz);
  await recordDueDateChanged(task.id, existing.dueAt, parsedBoardDate, 'board_move', tz);

  return json(task);
};

