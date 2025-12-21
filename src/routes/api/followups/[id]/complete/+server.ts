import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/followups/:id/complete - mark follow-up as complete
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

  // Create activity entry for timeline
  const activityDescription = notes
    ? `Follow-up completed${followUp.targetPerson ? ` with ${followUp.targetPerson.displayName}` : ''}: ${notes}`
    : `Follow-up completed${followUp.targetPerson ? ` with ${followUp.targetPerson.displayName}` : ''}`;

  await db.taskActivity.create({
    data: {
      taskId: followUp.taskId,
      activityType: 'followup_completed',
      description: activityDescription,
      note: notes || null,
      metadata: {
        followUpId: followUp.id,
        followUpType: followUp.followUpType,
        targetPersonId: followUp.targetPersonId,
      }
    }
  });

  return json(followUp);
};

