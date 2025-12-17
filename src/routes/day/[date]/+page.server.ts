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
    orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Separate tasks scheduled for this day from tasks only due on this day
  const scheduledTasks = tasks.filter((task) => {
    if (!task.boardDate) return false;
    const taskBoardDate = startOfDay(new Date(task.boardDate));
    return taskBoardDate.getTime() === targetDate.getTime();
  });

  const dueTasks = tasks.filter((task) => {
    const taskBoardDate = task.boardDate
      ? startOfDay(new Date(task.boardDate))
      : null;
    const taskDueAt = task.dueAt ? startOfDay(new Date(task.dueAt)) : null;

    // Task is due on this day, AND is NOT scheduled for this day
    const isDueThisDay =
      taskDueAt && taskDueAt.getTime() === targetDate.getTime();
    const notScheduledForThisDay =
      !taskBoardDate || taskBoardDate.getTime() !== targetDate.getTime();

    return isDueThisDay && notScheduledForThisDay;
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

