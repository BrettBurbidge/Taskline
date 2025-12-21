import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// PATCH /api/projects/[id] - update a project
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const projectId = params.id;
  const body = await request.json();
  const { isActive, name, description } = body;

  // Check if project exists and belongs to user
  const project = await db.project.findFirst({
    where: { 
      id: projectId,
      userId, // Verify ownership
    },
  });

  if (!project) {
    throw error(404, 'Project not found');
  }

  // Update project
  const updatedProject = await db.project.update({
    where: { id: projectId },
    data: {
      isActive: isActive !== undefined ? isActive : project.isActive,
      name: name !== undefined ? name : project.name,
      description: description !== undefined ? description : project.description,
    },
  });

  // If project is being marked as inactive (completed), mark all pending follow-ups as completed
  if (isActive === false && project.isActive === true) {
    // Get all task IDs for this project (filtered by user)
    const projectTasks = await db.task.findMany({
      where: { 
        projectId,
        userId, // Filter by user
      },
      select: { id: true },
    });

    const taskIds = projectTasks.map((t) => t.id);

    if (taskIds.length > 0) {
      // Mark all pending follow-ups for tasks in this project as completed
      await db.followUp.updateMany({
        where: {
          taskId: { in: taskIds },
          status: 'pending',
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }
  }

  return json(updatedProject);
};

// DELETE /api/projects/[id] - delete a project
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const projectId = params.id;
  const body = await request.json();
  const { moveToProjectId } = body; // Can be null to unassign tasks

  // Check if project exists and belongs to user
  const project = await db.project.findFirst({
    where: { 
      id: projectId,
      userId, // Verify ownership
    },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  if (!project) {
    throw error(404, 'Project not found');
  }

  // If there are tasks, reassign them (only for this user)
  if (project._count.tasks > 0) {
    await db.task.updateMany({
      where: { 
        projectId,
        userId, // Filter by user
      },
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

