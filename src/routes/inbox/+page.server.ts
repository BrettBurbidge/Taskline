import { db } from '$lib/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Fetch data needed for the inbox page
  const [people, projects] = await Promise.all([
    db.person.findMany({
      orderBy: { handle: 'asc' },
    }),
    db.project.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Get the current user (Brett)
  const currentUser = people.find((p) => p.handle === 'brett');

  return {
    people,
    projects,
    currentUser,
  };
};

