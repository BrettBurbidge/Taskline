import { db } from "$lib/db";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  format,
  startOfDay,
} from "date-fns";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  // Get week offset from URL params (0 = this week, -1 = last week, 1 = next week, etc.)
  const weekOffset = parseInt(url.searchParams.get("offset") || "0", 10);

  const today = new Date();
  const referenceDate = addWeeks(today, weekOffset);
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 }); // Sunday

  // Fetch tasks for the week (including completed tasks)
  const tasks = await db.task.findMany({
    where: {
      OR: [
        {
          dueAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        {
          boardDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      ],
      status: { notIn: ["cancelled"] },
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
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  // Group tasks by date
  const tasksByDate: Record<string, typeof tasks> = {};
  const overdueTasks: typeof tasks = [];
  const noDueDateTasks: typeof tasks = [];

  const todayStart = startOfDay(today);

  for (const task of tasks) {
    const dueDate = task.dueAt || task.boardDate;

    if (!dueDate) {
      noDueDateTasks.push(task);
    } else {
      const taskDate = startOfDay(new Date(dueDate));
      const dateKey = format(taskDate, "yyyy-MM-dd");

      // Check if overdue (before today) - only show if viewing current or past weeks
      if (
        taskDate < todayStart &&
        task.status !== "completed" &&
        weekOffset <= 0
      ) {
        overdueTasks.push(task);
      } else {
        if (!tasksByDate[dateKey]) {
          tasksByDate[dateKey] = [];
        }
        tasksByDate[dateKey].push(task);
      }
    }
  }

  // Generate week dates
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    weekDates.push(format(addDays(weekStart, i), "yyyy-MM-dd"));
  }

  return {
    tasksByDate,
    overdueTasks,
    noDueDateTasks,
    weekDates,
    weekStart: format(weekStart, "yyyy-MM-dd"),
    weekEnd: format(weekEnd, "yyyy-MM-dd"),
    weekOffset,
  };
};
