import { db } from '$lib/db';
import { startOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = startOfDay(subDays(now, 1));
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const thisMonthStart = startOfMonth(now);

  // Fetch all completed tasks with relations
  const completedTasks = await db.task.findMany({
    where: {
      status: 'completed',
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
    orderBy: {
      completedAt: 'desc',
    },
  });

  // Group tasks by time period
  const groupedTasks = {
    today: completedTasks.filter(
      (task) => task.completedAt && task.completedAt >= today
    ),
    yesterday: completedTasks.filter(
      (task) =>
        task.completedAt &&
        task.completedAt >= yesterday &&
        task.completedAt < today
    ),
    thisWeek: completedTasks.filter(
      (task) =>
        task.completedAt &&
        task.completedAt >= thisWeekStart &&
        task.completedAt < yesterday
    ),
    thisMonth: completedTasks.filter(
      (task) =>
        task.completedAt &&
        task.completedAt >= thisMonthStart &&
        task.completedAt < thisWeekStart
    ),
    older: completedTasks.filter(
      (task) => task.completedAt && task.completedAt < thisMonthStart
    ),
  };

  // Get stats
  const stats = {
    today: groupedTasks.today.length,
    thisWeek:
      groupedTasks.today.length +
      groupedTasks.yesterday.length +
      groupedTasks.thisWeek.length,
    thisMonth: completedTasks.filter(
      (task) => task.completedAt && task.completedAt >= thisMonthStart
    ).length,
    total: completedTasks.length,
  };

  // Get all projects and people for filters
  const projects = await db.project.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const people = await db.person.findMany({
    orderBy: { displayName: 'asc' },
  });

  return {
    groupedTasks,
    stats,
    projects,
    people,
  };
};

