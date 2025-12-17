import { json } from "@sveltejs/kit";
import { db } from "$lib/db";
import { startOfDay, addDays } from "date-fns";
import type { RequestHandler } from "./$types";

// POST /api/board/rollover - move incomplete tasks to next day (smart rollover)
export const POST: RequestHandler = async ({ request }) => {
  const { fromDate, toDate } = await request.json();

  // Parse dates at noon local time to avoid timezone issues
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const from = new Date(fromYear, fromMonth - 1, fromDay, 12, 0, 0, 0);

  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const to = new Date(toYear, toMonth - 1, toDay, 12, 0, 0, 0);

  // Find all incomplete tasks scheduled for fromDate
  const tasksToRollover = await db.task.findMany({
    where: {
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
  const fromDayStart = startOfDay(from);
  const toDayStart = startOfDay(to);

  for (const task of tasksToRollover) {
    const updates: any = {
      boardDate: to,
      sortOrder: null, // Reset sort order
    };

    // If task has a dueAt that's today or earlier (overdue), move the due date too
    if (task.dueAt) {
      const taskDueDate = startOfDay(new Date(task.dueAt));
      if (taskDueDate <= fromDayStart) {
        // Task is due today or overdue - move the due date forward too
        updates.dueAt = to;
      }
    }

    await db.task.update({
      where: { id: task.id },
      data: updates,
    });

    count++;
  }

  return json({ count });
};
