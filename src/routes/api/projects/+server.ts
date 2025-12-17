import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// GET /api/projects - fetch all projects
export const GET: RequestHandler = async () => {
  const projects = await db.project.findMany({
    where: { isActive: true },
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
export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      isActive: true,
    },
  });

  return json(project, { status: 201 });
};

