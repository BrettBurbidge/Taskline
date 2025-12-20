import { db } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const projects = await db.project.findMany({
    where: { isActive: true },
    include: {
      tasks: {
        where: {
          status: { notIn: ['cancelled'] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
        },
        orderBy: { dueAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate task counts by status for each project
  const projectsWithCounts = projects.map((project) => {
    const taskCounts = {
      notStarted: project.tasks.filter((t) => t.status === 'not_started').length,
      inProgress: project.tasks.filter((t) => t.status === 'in_progress').length,
      waiting: project.tasks.filter((t) => t.status === 'waiting').length,
      completed: project.tasks.filter((t) => t.status === 'completed').length,
      total: project.tasks.length,
    };

    return {
      ...project,
      taskCounts,
    };
  });

  return {
    projects: projectsWithCounts,
  };
};

