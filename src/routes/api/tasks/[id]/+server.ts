import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// GET /api/tasks/:id - fetch single task
export const GET: RequestHandler = async ({ params }) => {
  const task = await db.task.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: {
          person: true,
        },
      },
      followUps: {
        include: {
          targetPerson: true,
        },
        orderBy: { dueAt: 'asc' },
      },
      contextNotes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    throw error(404, 'Task not found');
  }

  return json(task);
};

// PATCH /api/tasks/:id - update task
export const PATCH: RequestHandler = async ({ params, request }) => {
  const data = await request.json();

  const task = await db.task.update({
    where: { id: params.id },
    data: {
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      boardDate: data.boardDate ? new Date(data.boardDate) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
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

  return json(task);
};

// DELETE /api/tasks/:id - delete task
export const DELETE: RequestHandler = async ({ params }) => {
  await db.task.delete({
    where: { id: params.id },
  });

  return json({ success: true });
};

