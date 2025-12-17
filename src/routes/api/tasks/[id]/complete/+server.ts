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

  // If task belongs to a project, check if all tasks in that project are now completed
  // If so, delete all follow-ups for tasks in that project
  if (task.projectId) {
    const projectTasks = await db.task.findMany({
      where: {
        projectId: task.projectId,
        status: { notIn: ['cancelled'] },
      },
    });

    // Check if all non-cancelled tasks are completed
    const allCompleted = projectTasks.every((t) => t.status === 'completed');

    if (allCompleted && projectTasks.length > 0) {
      // Delete all pending follow-ups for tasks in this project
      const taskIds = projectTasks.map((t) => t.id);
      await db.followUp.deleteMany({
        where: {
          taskId: { in: taskIds },
          status: 'pending',
        },
      });
    } else {
      // Even if not all tasks are completed, delete follow-ups for this specific completed task
      await db.followUp.deleteMany({
        where: {
          taskId: task.id,
          status: 'pending',
        },
      });
    }
  } else {
    // Task has no project - just delete follow-ups for this task
    await db.followUp.deleteMany({
      where: {
        taskId: task.id,
        status: 'pending',
      },
    });
  }

  return json(task);
};

