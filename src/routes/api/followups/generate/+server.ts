import { json } from '@sveltejs/kit';
import { generateForActiveTasks } from '$lib/services/followupEngine';
import { db } from '$lib/db';
import { startOfDay, addDays } from 'date-fns';
import { getStartOfDayUTC } from '$lib/utils/timezone';
import type { RequestHandler } from './$types';

// POST /api/followups/generate - generate follow-ups for all active tasks
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { boardDate, timezone } = body;

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  const date = boardDate ? new Date(boardDate) : new Date();

  await generateForActiveTasks(date, undefined, tz);

  // Count how many follow-ups were created
  const today = getStartOfDayUTC(new Date(), tz);
  
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

