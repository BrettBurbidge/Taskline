import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// DELETE /api/context-notes/[id] - delete a context note
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, 'Unauthorized');

  // Ownership check via the linked project or task
  const note = await db.contextNote.findFirst({
    where: {
      id: params.id,
      OR: [
        { project: { userId } },
        { task: { userId } },
      ],
    },
  });

  if (!note) throw error(404, 'Context note not found');

  await db.contextNote.delete({ where: { id: params.id } });
  return json({ success: true });
};
