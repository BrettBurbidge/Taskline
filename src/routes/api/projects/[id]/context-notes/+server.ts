import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/projects/[id]/context-notes - add a context note to a project
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, 'Unauthorized');

  const project = await db.project.findFirst({ where: { id: params.id, userId } });
  if (!project) throw error(404, 'Project not found');

  const { content, noteType = 'general' } = await request.json();
  if (!content) throw error(400, 'content is required');

  const note = await db.contextNote.create({
    data: { content, noteType, projectId: params.id },
  });

  return json(note, { status: 201 });
};
