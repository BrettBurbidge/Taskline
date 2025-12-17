import { db } from '$lib/db';
import { format, startOfDay, addDays, isEqual, isBefore } from 'date-fns';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const today = startOfDay(new Date());
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
          status: { in: ['not_started', 'in_progress', 'waiting'] },
        },
        // Tasks due today or overdue (show even if scheduled for a future board date)
        {
          dueAt: {
            lt: tomorrow, // Due today or earlier
          },
          status: { in: ['not_started', 'in_progress', 'waiting'] },
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
    orderBy: [{ dueAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  // Separate overdue/due tasks from scheduled tasks
  const scheduledTasks = tasks.filter(task => {
    if (!task.boardDate) return false;
    const taskBoardDate = startOfDay(new Date(task.boardDate));
    // Task is scheduled specifically for today
    return isEqual(taskBoardDate, today);
  });

  const dueTasks = tasks.filter(task => {
    const taskBoardDate = task.boardDate ? startOfDay(new Date(task.boardDate)) : null;
    const taskDueAt = task.dueAt ? startOfDay(new Date(task.dueAt)) : null;
    
    // Task is due today or overdue, AND is NOT scheduled for today
    const isDueOrOverdue = taskDueAt && !isBefore(tomorrow, taskDueAt); // dueAt is today or before
    const notScheduledForToday = !taskBoardDate || !isEqual(taskBoardDate, today);
    
    return isDueOrOverdue && notScheduledForToday;
  });

  // Fetch follow-ups due today
  const followUps = await db.followUp.findMany({
    where: {
      dueAt: {
        gte: today,
        lt: tomorrow,
      },
      status: 'pending',
    },
    include: {
      task: {
        include: {
          project: true,
        },
      },
      targetPerson: true,
    },
    orderBy: { dueAt: 'asc' },
  });

  return {
    tasks,
    scheduledTasks,
    dueTasks,
    followUps,
    todayDate: format(today, 'yyyy-MM-dd'),
  };
};

