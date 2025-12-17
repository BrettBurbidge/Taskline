import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/complete - mark task as complete
export const POST: RequestHandler = async ({ params }) => {
  const task = await db.task.update({
    where: { id: params.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
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

  if (!task) {
    throw error(404, 'Task not found');
  }

  return json(task);
};

