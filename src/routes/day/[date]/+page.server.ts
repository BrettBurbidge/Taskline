import { db } from "$lib/db";
import { format, startOfDay, addDays, parseISO } from "date-fns";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  // Parse the date from URL params (format: YYYY-MM-DD)
  let targetDate: Date;
  try {
    targetDate = startOfDay(parseISO(params.date));
  } catch {
    throw error(400, "Invalid date format");
  }

  const nextDay = addDays(targetDate, 1);

  // Fetch all tasks relevant to this specific day:
  // - Tasks with boardDate = targetDate (scheduled to work on this day)
  // - Tasks with dueAt on or before targetDate (due or overdue)
  const tasks = await db.task.findMany({
    where: {
      OR: [
        // Tasks scheduled for this day
        {
          boardDate: targetDate,
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Tasks due on or before this day
        {
          dueAt: {
            lte: nextDay,
          },
          status: { in: ["not_started", "in_progress", "waiting"] },
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

  // Fetch follow-ups due on this day
  const followUps = await db.followUp.findMany({
    where: {
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

