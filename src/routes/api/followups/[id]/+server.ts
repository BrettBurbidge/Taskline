import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// DELETE /api/followups/:id - delete a follow-up
export const DELETE: RequestHandler = async ({ params }) => {
  const followUp = await db.followUp.findUnique({
    where: { id: params.id },
  });

  if (!followUp) {
    throw error(404, 'Follow-up not found');
  }

  await db.followUp.delete({
    where: { id: params.id },
  });

  return json({ success: true });
};

