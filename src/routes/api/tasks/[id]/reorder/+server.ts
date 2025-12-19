import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import { dateStringToUTC, getStartOfDayUTC } from '$lib/utils/timezone';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/reorder - move task up or down
export const POST: RequestHandler = async ({ params, request }) => {
  const { direction, targetDate, timezone } = await request.json();

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  const task = await db.task.findUnique({
    where: { id: params.id },
    select: { id: true, boardDate: true, dueAt: true, sortOrder: true },
  });

  if (!task) {
    throw error(404, 'Task not found');
  }

  // Determine the date to use for reordering
  // If task has boardDate, use it. Otherwise, use dueAt or targetDate
  let targetBoardDate: Date | null = task.boardDate;
  
  if (!targetBoardDate) {
    if (targetDate) {
      // Parse targetDate using timezone utilities
      targetBoardDate = dateStringToUTC(targetDate, tz);
    } else if (task.dueAt) {
      // Use dueAt date (convert to start of day in user's timezone)
      targetBoardDate = getStartOfDayUTC(new Date(task.dueAt), tz);
    } else {
      throw error(400, 'Task has no board date, due date, or target date');
    }
    
    // Set boardDate for this task if it doesn't have one
    await db.task.update({
      where: { id: task.id },
      data: { boardDate: targetBoardDate },
    });
  }

  // Get all tasks on the same board date
  const tasksOnDate = await db.task.findMany({
    where: {
      boardDate: targetBoardDate,
      status: { in: ['not_started', 'in_progress', 'waiting'] },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  // Find current index
  const currentIndex = tasksOnDate.findIndex((t) => t.id === task.id);
  if (currentIndex === -1) {
    throw error(404, 'Task not found in board');
  }

  // Determine swap index
  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (swapIndex < 0 || swapIndex >= tasksOnDate.length) {
    // Already at boundary
    return json(task);
  }

  // Swap sort orders
  const currentTask = tasksOnDate[currentIndex];
  const swapTask = tasksOnDate[swapIndex];

  const currentOrder = currentTask.sortOrder ?? currentIndex;
  const swapOrder = swapTask.sortOrder ?? swapIndex;

  await db.$transaction([
    db.task.update({
      where: { id: currentTask.id },
      data: { sortOrder: swapOrder },
    }),
    db.task.update({
      where: { id: swapTask.id },
      data: { sortOrder: currentOrder },
    }),
  ]);

  const updatedTask = await db.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: { person: true },
      },
    },
  });

  return json(updatedTask);
};

