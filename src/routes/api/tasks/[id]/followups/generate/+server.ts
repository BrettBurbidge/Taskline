import { json, error } from '@sveltejs/kit';
import { generateForTask } from '$lib/services/followupEngine';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/followups/generate - regenerate follow-ups for a specific task
export const POST: RequestHandler = async ({ params, locals, request }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  // Verify the task belongs to this user
  const task = await db.task.findFirst({
    where: {
      id: params.id,
      userId,
    },
  });

  if (!task) {
    throw error(404, 'Task not found or access denied');
  }

  const body = await request.json().catch(() => ({}));
  const { timezone } = body;
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  await generateForTask(params.id, userId, new Date(), tz);

  return json({ success: true, message: 'Follow-ups regenerated' });
};

