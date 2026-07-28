import { json, error } from '@sveltejs/kit';
import { draftTaskEmail, isAIAvailable } from '$lib/services/ai';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/ai/draft-email - draft a summary email for a task
export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  if (!isAIAvailable()) {
    return json(
      { error: 'AI assistance not configured. Set ANTHROPIC_API_KEY environment variable.' },
      { status: 503 }
    );
  }

  const { taskId } = await request.json();

  const task = await db.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: { person: true },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      contextNotes: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });

  if (!task) {
    return json({ error: 'Task not found' }, { status: 404 });
  }

  // Build recent activity summary
  const activityLines = task.activities.map(
    (a: any) => `- ${a.description}`
  );
  const noteLines = task.contextNotes.map(
    (n: any) => `- Note: ${n.content}`
  );
  const recentActivitySummary = [...activityLines, ...noteLines].join('\n') || undefined;

  const draft = await draftTaskEmail({
    taskTitle: task.title,
    taskDescription: task.description || undefined,
    projectName: task.project?.name,
    accountablePersonName: task.accountablePerson.displayName,
    executorPersonName: task.executorPerson?.displayName,
    stakeholderNames: task.stakeholders.map((s: any) => s.person.displayName),
    status: task.status,
    dueDate: task.dueAt || undefined,
    recentActivitySummary,
  });

  if (!draft) {
    return json({ error: 'Failed to generate email draft' }, { status: 500 });
  }

  return json(draft);
};
