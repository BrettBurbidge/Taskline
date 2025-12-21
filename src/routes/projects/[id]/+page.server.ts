import { db } from '$lib/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const project = await db.project.findFirst({
    where: { 
      id: params.id,
      userId, // Multi-tenant filter
    },
    include: {
      tasks: {
        where: {
          status: { notIn: ['cancelled'] },
        },
        include: {
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
      },
      contextNotes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) {
    throw error(404, 'Project not found');
  }

  // Group tasks by status
  const tasksByStatus = {
    active: project.tasks.filter((t) =>
      ['not_started', 'in_progress', 'waiting'].includes(t.status)
    ),
    completed: project.tasks.filter((t) => t.status === 'completed'),
  };

  // Get all other projects (for reassignment when deleting, filtered by userId)
  const otherProjects = await db.project.findMany({
    where: {
      userId, // Multi-tenant filter
      id: { not: params.id },
      isActive: true,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    project,
    tasksByStatus,
    otherProjects,
  };
};

