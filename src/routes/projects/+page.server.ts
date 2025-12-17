import { db } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const projects = await db.project.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              status: { notIn: ['completed', 'cancelled'] },
            },
          },
        },
      },
      tasks: {
        where: {
          status: { notIn: ['completed', 'cancelled'] },
        },
        orderBy: { dueAt: 'asc' },
        take: 3, // Show preview of first 3 tasks
        include: {
          accountablePerson: true,
          executorPerson: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return {
    projects,
  };
};

