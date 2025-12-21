import { db } from '$lib/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  // Fetch data needed for the inbox page (filtered by userId)
  const [people, projects, currentUser] = await Promise.all([
    db.person.findMany({
      where: { userId },
      orderBy: { handle: 'asc' },
    }),
    db.project.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { name: 'asc' },
    }),
    // Get the "me" person for the current user
    db.person.findFirst({
      where: { 
        userId,
        handle: 'me'
      },
    }),
  ]);

  return {
    people,
    projects,
    currentUser,
  };
};

