import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import { recordCompleted } from '$lib/services/taskActivity';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/complete - mark task as complete
export const POST: RequestHandler = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const task = await db.task.update({
    where: { 
      id: params.id,
      userId, // Verify ownership
    },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: {
          person: true,
        },
      },
    },
  });

  if (!task) {
    throw error(404, 'Task not found');
  }

  await recordCompleted(task.id);

  // Get all pending follow-ups for this task before marking them complete
  const pendingFollowUps = await db.followUp.findMany({
    where: {
      taskId: task.id,
      status: 'pending',
    },
    include: {
      targetPerson: true,
    },
  });

  // Mark all pending follow-ups for this task as completed
  await db.followUp.updateMany({
    where: {
      taskId: task.id,
      status: 'pending',
    },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Create timeline entries for each auto-completed follow-up
  for (const followUp of pendingFollowUps) {
    const activityDescription = `Follow-up auto-completed (task completed)${followUp.targetPerson ? ` with ${followUp.targetPerson.displayName}` : ''}`;
    
    await db.taskActivity.create({
      data: {
        taskId: task.id,
        activityType: 'followup_completed',
        description: activityDescription,
        metadata: {
          followUpId: followUp.id,
          followUpType: followUp.followUpType,
          targetPersonId: followUp.targetPersonId,
          autoCompleted: true,
        },
      },
    });
  }

  return json(task);
};

