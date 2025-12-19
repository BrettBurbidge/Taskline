import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/followups - create a new follow-up
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { taskId, followUpType, targetPersonId, dueAt } = body;

  if (!taskId || !followUpType || !dueAt) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const followUp = await db.followUp.create({
    data: {
      taskId,
      followUpType,
      targetPersonId: targetPersonId || null,
      dueAt: new Date(dueAt),
      status: 'pending',
    },
    include: {
      task: true,
      targetPerson: true,
    },
  });

  return json(followUp);
};

