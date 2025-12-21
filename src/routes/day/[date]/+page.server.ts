import { db } from "$lib/db";
import { format, startOfDay, addDays, parseISO } from "date-fns";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  // Parse the date from URL params (format: YYYY-MM-DD)
  let targetDate: Date;
  try {
    targetDate = startOfDay(parseISO(params.date));
  } catch {
    throw error(400, "Invalid date format");
  }

  const nextDay = addDays(targetDate, 1);

  // Fetch all tasks relevant to this specific day (filtered by userId):
  // - Active tasks: with boardDate = targetDate OR dueAt on/before targetDate
  // - Completed tasks: ONLY if dueAt is on this specific day
  const tasks = await db.task.findMany({
    where: {
      userId, // Multi-tenant filter
      OR: [
        // Active tasks scheduled for this day
        {
          boardDate: targetDate,
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Active tasks due on or before this day
        {
          dueAt: {
            lte: nextDay,
          },
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Completed tasks ONLY if due on this specific day
        {
          dueAt: {
            gte: targetDate,
            lt: nextDay,
          },
          status: "completed",
        },
      ],
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: {
          person: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });

  // Remove duplicates and sort by priority
  const uniqueTasksMap = new Map();
  for (const task of tasks) {
    if (!uniqueTasksMap.has(task.id)) {
      uniqueTasksMap.set(task.id, task);
    }
  }

  const dayTasks = Array.from(uniqueTasksMap.values()).sort((a, b) => {
    // Sort by sortOrder first (nulls last)
    const aOrder = a.sortOrder ?? 999999;
    const bOrder = b.sortOrder ?? 999999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Then by dueAt (earlier dates first, nulls last)
    if (a.dueAt && b.dueAt) {
      return a.dueAt.getTime() - b.dueAt.getTime();
    }
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    
    // Finally by creation date (newer first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Fetch follow-ups due on this day (filtered through task's userId)
  const followUps = await db.followUp.findMany({
    where: {
      task: {
        userId, // Multi-tenant filter through relation
      },
      dueAt: {
        gte: targetDate,
        lt: nextDay,
      },
      status: "pending",
    },
    include: {
      task: {
        include: {
          project: true,
        },
      },
      targetPerson: true,
    },
    orderBy: { dueAt: "asc" },
  });

  return {
    date: params.date,
    dayTasks,
    followUps,
    targetDate: format(targetDate, "yyyy-MM-dd"),
  };
};

