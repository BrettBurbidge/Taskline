import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import { generateForTask } from '$lib/services/followupEngine';
import type { RequestHandler } from './$types';

// GET /api/tasks/:id - fetch single task
export const GET: RequestHandler = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const task = await db.task.findFirst({
    where: { 
      id: params.id,
      userId, // Verify ownership
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
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const data = await request.json();

  // Fetch the existing task to compare dueAt
  const existingTask = await db.task.findFirst({
    where: { 
      id: params.id,
      userId,
    },
    select: { id: true, dueAt: true },
  });

  if (!existingTask) {
    throw error(404, 'Task not found or access denied');
  }

  const task = await db.task.update({
    where: { 
      id: params.id,
      userId, // Verify ownership
    },
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

  // If due date changed, regenerate follow-ups
  const newDueAt = data.dueAt ? new Date(data.dueAt).getTime() : null;
  const oldDueAt = existingTask.dueAt ? new Date(existingTask.dueAt).getTime() : null;
  
  if (newDueAt !== oldDueAt) {
    // Regenerate follow-ups based on the new due date
    try {
      await generateForTask(task.id, userId, new Date(), data.timezone);
    } catch (err) {
      console.error('Failed to regenerate follow-ups:', err);
      // Don't fail the request if follow-up generation fails
    }
  }

  return json(task);
};

// DELETE /api/tasks/:id - delete task
export const DELETE: RequestHandler = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  await db.task.delete({
    where: { 
      id: params.id,
      userId, // Verify ownership
    },
  });

  return json({ success: true });
};

