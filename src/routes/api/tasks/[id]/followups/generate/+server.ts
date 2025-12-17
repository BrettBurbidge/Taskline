import { json } from '@sveltejs/kit';
import { generateForTask } from '$lib/services/followupEngine';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/followups/generate - regenerate follow-ups for a specific task
export const POST: RequestHandler = async ({ params }) => {
  await generateForTask(params.id);

  return json({ success: true, message: 'Follow-ups regenerated' });
};

