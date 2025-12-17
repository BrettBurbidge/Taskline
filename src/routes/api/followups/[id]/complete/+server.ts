import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/followups/:id/complete - mark follow-up as complete
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => ({}));
  const { notes } = body;

  const followUp = await db.followUp.update({
    where: { id: params.id },
    data: {
      status: 'completed',
      completedAt: new Date(),
      notes: notes || null,
    },
    include: {
      task: true,
      targetPerson: true,
    },
  });

  return json(followUp);
};

