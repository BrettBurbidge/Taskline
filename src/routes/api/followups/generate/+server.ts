import { json } from '@sveltejs/kit';
import { generateForActiveTasks } from '$lib/services/followupEngine';
import { db } from '$lib/db';
import { startOfDay, addDays } from 'date-fns';
import type { RequestHandler } from './$types';

// POST /api/followups/generate - generate follow-ups for all active tasks
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { boardDate } = body;

  const date = boardDate ? new Date(boardDate) : new Date();

  await generateForActiveTasks(date);

  // Count how many follow-ups were created
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  
  const count = await db.followUp.count({
    where: {
      status: 'pending',
      dueAt: {
        gte: today,
      },
    },
  });

  return json({ success: true, count, message: 'Follow-ups generated' });
};

