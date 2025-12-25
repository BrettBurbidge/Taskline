import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { startOfDay, addDays } from "date-fns";
import { dateStringToUTC, getStartOfDayUTC } from "$lib/utils/timezone";
import { generateForTask } from "$lib/services/followupEngine";
import type { RequestHandler } from "./$types";

// POST /api/board/rollover - move incomplete tasks to next day (smart rollover)
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  const { fromDate, toDate, timezone } = await request.json();

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  // Parse dates using timezone utilities
  const from = dateStringToUTC(fromDate, tz);
  const to = dateStringToUTC(toDate, tz);

  // Find all incomplete tasks scheduled for fromDate (filtered by userId)
  const tasksToRollover = await db.task.findMany({
    where: {
      userId, // Multi-tenant filter
      boardDate: from,
      status: { in: ["not_started", "in_progress", "waiting"] },
    },
    select: {
      id: true,
      dueAt: true,
    },
  });

  // Smart rollover: update each task individually
  let count = 0;
  const fromDayStart = getStartOfDayUTC(from, tz);
  const toDayStart = getStartOfDayUTC(to, tz);

  for (const task of tasksToRollover) {
    const updates: any = {
      boardDate: to,
      sortOrder: null, // Reset sort order
    };

    let dueDateChanged = false;

    // If task has a dueAt that's today or earlier (overdue), move the due date too
    if (task.dueAt) {
      const taskDueDate = getStartOfDayUTC(new Date(task.dueAt), tz);
      if (taskDueDate <= fromDayStart) {
        // Task is due today or overdue - move the due date forward too
        updates.dueAt = to;
        dueDateChanged = true;
      }
    }

    await db.task.update({
      where: { id: task.id },
      data: updates,
    });

    // If due date changed, regenerate follow-ups
    if (dueDateChanged) {
      try {
        await generateForTask(task.id, userId, new Date(), tz);
      } catch (err) {
        console.error('Failed to regenerate follow-ups for task:', task.id, err);
        // Don't fail the rollover if follow-up generation fails
      }
    }

    count++;
  }

  return json({ count });
};
