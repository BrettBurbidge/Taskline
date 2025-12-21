import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler} from './$types';

// GET /api/projects - fetch all projects
export const GET: RequestHandler = async ({ locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const projects = await db.project.findMany({
    where: { 
      userId, // Filter by user
      isActive: true 
    },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  });

  return json(projects);
};

// POST /api/projects - create a new project
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const data = await request.json();

  const project = await db.project.create({
    data: {
      userId, // Multi-tenant isolation
      name: data.name,
      description: data.description || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      isActive: true,
    },
  });

  return json(project, { status: 201 });
};

