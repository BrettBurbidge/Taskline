import { db } from "$lib/db";
import { addDays } from "date-fns";
import { getStartOfDayUTC, getTodayString } from "$lib/utils/timezone";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  // Get user's timezone from cookie (set by client) or use default
  const userTimezone =
    cookies.get("user_timezone") ||
    process.env.DEFAULT_TIMEZONE ||
    "America/Denver";

  // Calculate today in user's timezone (as UTC Date representing start of day in user TZ)
  const today = getStartOfDayUTC(new Date(), userTimezone);
  const tomorrow = addDays(today, 1);

  // Fetch all tasks relevant to today (filtered by userId for multi-tenant isolation)
  // - Active tasks: with boardDate = today OR dueAt on/before today
  // - Completed tasks: ONLY if dueAt is today
  const tasks = await db.task.findMany({
    where: {
      userId, // Multi-tenant filter
      OR: [
        // Active tasks scheduled for today
        {
          boardDate: today,
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Active tasks due today or overdue
        {
          dueAt: {
            lt: tomorrow, // Due today or earlier
          },
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Completed tasks ONLY if due today
        {
          dueAt: {
            gte: today,
            lt: tomorrow,
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

  const todayTasks = Array.from(uniqueTasksMap.values()).sort((a, b) => {
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

  // Fetch follow-ups due today (filtered through task's userId)
  const followUps = await db.followUp.findMany({
    where: {
      task: {
        userId, // Multi-tenant filter through relation
      },
      dueAt: {
        gte: today,
        lt: tomorrow,
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
    todayTasks,
    followUps,
    todayDate: getTodayString(userTimezone),
  };
};
