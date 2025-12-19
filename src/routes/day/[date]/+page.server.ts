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

  // Fetch tasks for this specific day:
  // 1. Tasks with boardDate = targetDate (scheduled for this day)
  // 2. Tasks with dueAt = targetDate (due on this day)
  const tasks = await db.task.findMany({
    where: {
      OR: [
        // Tasks scheduled for this day
        {
          boardDate: targetDate,
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Tasks due on this day
        {
          dueAt: {
            gte: targetDate,
            lt: nextDay,
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

  // Separate tasks scheduled for this day from tasks only due on this day
  const scheduledTasks = tasks
    .filter((task) => {
      const taskBoardDate = task.boardDate
        ? startOfDay(new Date(task.boardDate))
        : null;
      const taskDueAt = task.dueAt ? startOfDay(new Date(task.dueAt)) : null;

      // Task is scheduled for this day (has boardDate = targetDate)
      if (taskBoardDate && taskBoardDate.getTime() === targetDate.getTime()) {
        return true;
      }

      // Task is due on this day and doesn't have a boardDate set
      // Include it in scheduled tasks so it appears in the bottom panel
      if (!taskBoardDate && taskDueAt) {
        const isDueThisDay = taskDueAt.getTime() === targetDate.getTime();
        return isDueThisDay;
      }

      return false;
    })
    .sort((a, b) => {
      // Sort by sortOrder first (nulls last), then by dueAt, then by createdAt
      const aOrder = a.sortOrder ?? 999999;
      const bOrder = b.sortOrder ?? 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      if (a.dueAt && b.dueAt) {
        return a.dueAt.getTime() - b.dueAt.getTime();
      }
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const dueTasks = tasks
    .filter((task) => {
      const taskBoardDate = task.boardDate
        ? startOfDay(new Date(task.boardDate))
        : null;
      const taskDueAt = task.dueAt ? startOfDay(new Date(task.dueAt)) : null;

      // Task is due on this day, AND is NOT scheduled for this day
      const isDueThisDay =
        taskDueAt && taskDueAt.getTime() === targetDate.getTime();
      
      // Exclude if it's scheduled for this day (has boardDate = targetDate)
      if (taskBoardDate && taskBoardDate.getTime() === targetDate.getTime()) {
        return false;
      }
      
      // Exclude if it's due on this day and doesn't have boardDate (it will be in scheduledTasks)
      if (!taskBoardDate && isDueThisDay) {
        return false;
      }

      // Only show overdue tasks (due before this day) in the due section
      if (taskDueAt && taskDueAt.getTime() < targetDate.getTime()) {
        return true;
      }

      return false;
    })
    .sort((a, b) => {
      // Sort by sortOrder first (nulls last), then by dueAt, then by createdAt
      const aOrder = a.sortOrder ?? 999999;
      const bOrder = b.sortOrder ?? 999999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      if (a.dueAt && b.dueAt) {
        return a.dueAt.getTime() - b.dueAt.getTime();
      }
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      
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
    scheduledTasks,
    dueTasks,
    followUps,
    targetDate: format(targetDate, "yyyy-MM-dd"),
  };
};

