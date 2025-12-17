import { db } from "$lib/db";
import { format, addDays, isEqual, isBefore } from "date-fns";
import { getStartOfDayUTC, getTodayString } from "$lib/utils/timezone";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  // Get user's timezone from cookie (set by client) or use default
  const userTimezone =
    cookies.get("user_timezone") ||
    process.env.DEFAULT_TIMEZONE ||
    "America/Denver";

  // Calculate today in user's timezone (as UTC Date representing start of day in user TZ)
  const today = getStartOfDayUTC(new Date(), userTimezone);
  const tomorrow = addDays(today, 1);

  // Fetch tasks for today:
  // 1. Tasks with boardDate = today (explicitly scheduled for today)
  // 2. Tasks with dueAt <= today (due today or overdue, regardless of board_date)
  const tasks = await db.task.findMany({
    where: {
      OR: [
        // Tasks scheduled for today
        {
          boardDate: today,
          status: { in: ["not_started", "in_progress", "waiting"] },
        },
        // Tasks due today or overdue (show even if scheduled for a future board date)
        {
          dueAt: {
            lt: tomorrow, // Due today or earlier
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
    orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Separate overdue/due tasks from scheduled tasks
  const scheduledTasks = tasks
    .filter((task) => {
      if (!task.boardDate) return false;
      const taskBoardDate = getStartOfDayUTC(
        new Date(task.boardDate),
        userTimezone
      );
      // Task is scheduled specifically for today
      return isEqual(taskBoardDate, today);
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
        ? getStartOfDayUTC(new Date(task.boardDate), userTimezone)
        : null;
      const taskDueAt = task.dueAt
        ? getStartOfDayUTC(new Date(task.dueAt), userTimezone)
        : null;

      // Task is due today or overdue, AND is NOT scheduled for today
      const isDueOrOverdue = taskDueAt && isBefore(taskDueAt, tomorrow); // dueAt is today or before
      const notScheduledForToday =
        !taskBoardDate || !isEqual(taskBoardDate, today);

      return isDueOrOverdue && notScheduledForToday;
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

  // Fetch follow-ups due today
  const followUps = await db.followUp.findMany({
    where: {
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
    tasks,
    scheduledTasks,
    dueTasks,
    followUps,
    todayDate: getTodayString(userTimezone),
  };
};
