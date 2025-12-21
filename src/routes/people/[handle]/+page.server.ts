import { db } from '$lib/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const handle = params.handle.toLowerCase();

  // Find person by handle (filtered by userId)
  const person = await db.person.findFirst({
    where: { 
      userId, // Multi-tenant filter
      handle 
    },
  });

  if (!person) {
    throw error(404, 'Person not found');
  }

  // Fetch all tasks where this person is involved
  const [accountableTasks, executorTasks, stakeholderTasks] = await Promise.all([
    // Tasks where person is accountable
    db.task.findMany({
      where: {
        accountablePersonId: person.id,
        status: { notIn: ['cancelled'] },
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
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
    // Tasks where person is executor
    db.task.findMany({
      where: {
        executorPersonId: person.id,
        status: { notIn: ['cancelled'] },
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
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
    // Tasks where person is stakeholder
    db.task.findMany({
      where: {
        stakeholders: {
          some: {
            personId: person.id,
          },
        },
        status: { notIn: ['cancelled'] },
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
      orderBy: [
        { status: 'asc' },
        { dueAt: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
  ]);

  // Remove duplicates (a task might appear in multiple categories)
  const allTaskIds = new Set<string>();
  const uniqueAccountableTasks = accountableTasks.filter((task) => {
    if (allTaskIds.has(task.id)) return false;
    allTaskIds.add(task.id);
    return true;
  });

  const uniqueExecutorTasks = executorTasks.filter((task) => {
    if (allTaskIds.has(task.id)) return false;
    allTaskIds.add(task.id);
    return true;
  });

  const uniqueStakeholderTasks = stakeholderTasks.filter((task) => {
    if (allTaskIds.has(task.id)) return false;
    allTaskIds.add(task.id);
    return true;
  });

  // Group tasks by status
  const groupByStatus = (tasks: typeof accountableTasks) => {
    return {
      active: tasks.filter((t) =>
        ['not_started', 'in_progress', 'waiting'].includes(t.status)
      ),
      completed: tasks.filter((t) => t.status === 'completed'),
    };
  };

  return {
    person,
    accountableTasks: groupByStatus(uniqueAccountableTasks),
    executorTasks: groupByStatus(uniqueExecutorTasks),
    stakeholderTasks: groupByStatus(uniqueStakeholderTasks),
  };
};





