import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

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

