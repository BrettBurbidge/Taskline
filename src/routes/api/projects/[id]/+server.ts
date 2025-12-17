import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// PATCH /api/projects/[id] - update a project
export const PATCH: RequestHandler = async ({ params, request }) => {
  const projectId = params.id;
  const body = await request.json();
  const { isActive } = body;

  // Check if project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw error(404, 'Project not found');
  }

  // Update project
  const updatedProject = await db.project.update({
    where: { id: projectId },
    data: {
      isActive: isActive !== undefined ? isActive : project.isActive,
    },
  });

  // If project is being marked as inactive (completed), delete all follow-ups for tasks in this project
  if (isActive === false && project.isActive === true) {
    // Get all task IDs for this project
    const projectTasks = await db.task.findMany({
      where: { projectId },
      select: { id: true },
    });

    const taskIds = projectTasks.map((t) => t.id);

    if (taskIds.length > 0) {
      // Delete all pending follow-ups for tasks in this project
      await db.followUp.deleteMany({
        where: {
          taskId: { in: taskIds },
          status: 'pending',
        },
      });
    }
  }

  return json(updatedProject);
};

// DELETE /api/projects/[id] - delete a project
export const DELETE: RequestHandler = async ({ params, request }) => {
  const projectId = params.id;
  const body = await request.json();
  const { moveToProjectId } = body; // Can be null to unassign tasks

  // Check if project exists
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  if (!project) {
    throw error(404, 'Project not found');
  }

  // If there are tasks, reassign them
  if (project._count.tasks > 0) {
    await db.task.updateMany({
      where: { projectId },
      data: {
        projectId: moveToProjectId || null, // null to unassign
      },
    });
  }

  // Delete the project (also deletes context notes via cascade)
  await db.project.delete({
    where: { id: projectId },
  });

  return json({ success: true, tasksReassigned: project._count.tasks });
};

