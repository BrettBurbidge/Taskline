import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/followups/:id/snooze - snooze a follow-up
export const POST: RequestHandler = async ({ params, request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  // First, verify the follow-up belongs to this user
  const existingFollowUp = await db.followUp.findUnique({
    where: { id: params.id },
    include: {
      task: true,
    },
  });

  if (!existingFollowUp) {
    throw error(404, 'Follow-up not found');
  }

  if (existingFollowUp.task.userId !== userId) {
    throw error(403, 'Access denied');
  }

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

