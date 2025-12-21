import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// DELETE /api/followups/:id - delete a follow-up
export const DELETE: RequestHandler = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  // Verify the follow-up belongs to this user (through task)
  const followUp = await db.followUp.findUnique({
    where: { id: params.id },
    include: {
      task: true,
    },
  });

  if (!followUp) {
    throw error(404, 'Follow-up not found');
  }

  if (followUp.task.userId !== userId) {
    throw error(403, 'Access denied');
  }

  await db.followUp.delete({
    where: { id: params.id },
  });

  return json({ success: true });
};

