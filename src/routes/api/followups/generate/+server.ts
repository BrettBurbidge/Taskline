import { json, error } from '@sveltejs/kit';
import { generateForActiveTasks } from '$lib/services/followupEngine';
import { db } from '$lib/db';
import { startOfDay, addDays } from 'date-fns';
import { getStartOfDayUTC } from '$lib/utils/timezone';
import type { RequestHandler } from './$types';

// POST /api/followups/generate - generate follow-ups for all active tasks
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const body = await request.json().catch(() => ({}));
  const { boardDate, timezone } = body;

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  const date = boardDate ? new Date(boardDate) : new Date();

  await generateForActiveTasks(date, userId, tz);

  // Count how many follow-ups were created for this user
  const today = getStartOfDayUTC(new Date(), tz);
  
  const count = await db.followUp.count({
    where: {
      status: 'pending',
      dueAt: {
        gte: today,
      },
      task: {
        userId,
      },
    },
  });

  return json({ success: true, count, message: 'Follow-ups generated' });
};

