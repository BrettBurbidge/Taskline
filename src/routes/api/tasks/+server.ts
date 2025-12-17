import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// GET /api/tasks - fetch tasks with optional filters
export const GET: RequestHandler = async ({ url }) => {
  const boardDate = url.searchParams.get('boardDate');
  const dueFrom = url.searchParams.get('dueFrom');
  const dueTo = url.searchParams.get('dueTo');
  const projectId = url.searchParams.get('projectId');

  const where: any = {};

  if (boardDate) {
    where.boardDate = new Date(boardDate);
  }

  if (dueFrom || dueTo) {
    where.dueAt = {};
    if (dueFrom) where.dueAt.gte = new Date(dueFrom);
    if (dueTo) where.dueAt.lte = new Date(dueTo);
  }

  if (projectId) {
    where.projectId = projectId;
  }

  const tasks = await db.task.findMany({
    where,
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
    orderBy: [{ boardDate: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return json(tasks);
};

// POST /api/tasks - create a new task
export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const {
    title,
    description,
    dueAt,
    projectId,
    accountablePersonId,
    executorPersonId,
    stakeholderPersonIds = [],
    boardDate,
    priority,
  } = data;

  // Parse dates consistently - at noon local time to avoid timezone issues
  let parsedDueAt: Date | null = null;
  if (dueAt) {
    const dateStr = typeof dueAt === 'string' ? dueAt : dueAt.toISOString();
    if (dateStr.includes('T')) {
      // Already has time component
      parsedDueAt = new Date(dateStr);
    } else {
      // Date-only string like "2025-12-15"
      const [year, month, day] = dateStr.split('-').map(Number);
      parsedDueAt = new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  let parsedBoardDate: Date | null = null;
  if (boardDate) {
    const dateStr = typeof boardDate === 'string' ? boardDate : boardDate.toISOString();
    if (dateStr.includes('T')) {
      parsedBoardDate = new Date(dateStr);
    } else {
      const [year, month, day] = dateStr.split('-').map(Number);
      parsedBoardDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  // Create the task
  const task = await db.task.create({
    data: {
      title,
      description,
      dueAt: parsedDueAt,
      projectId: projectId || null,
      accountablePersonId,
      executorPersonId: executorPersonId || accountablePersonId,
      boardDate: parsedBoardDate,
      priority: priority || null,
      status: 'not_started',
      stakeholders: {
        create: stakeholderPersonIds.map((personId: string) => ({
          personId,
        })),
      },
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
  });

  return json(task, { status: 201 });
};

