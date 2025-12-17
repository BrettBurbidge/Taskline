import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/followups/:id/snooze - snooze a follow-up
export const POST: RequestHandler = async ({ params, request }) => {
  const { until } = await request.json();

  const followUp = await db.followUp.update({
    where: { id: params.id },
    data: {
      status: 'snoozed',
      snoozedUntil: new Date(until),
    },
    include: {
      task: true,
      targetPerson: true,
    },
  });

  return json(followUp);
};

