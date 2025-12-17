import { json } from '@sveltejs/kit';
import { draftMessage, isAIAvailable } from '$lib/services/ai';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/ai/draft-message - draft a message for follow-up
export const POST: RequestHandler = async ({ request }) => {
  if (!isAIAvailable()) {
    return json(
      { error: 'AI assistance not configured. Set OPENAI_API_KEY environment variable.' },
      { status: 503 }
    );
  }

  const { taskId, targetPersonId, channel, intent } = await request.json();

  // Fetch task and target person
  const [task, person] = await Promise.all([
    db.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    }),
    db.person.findUnique({
      where: { id: targetPersonId },
    }),
  ]);

  if (!task || !person) {
    return json({ error: 'Task or person not found' }, { status: 404 });
  }

  const draft = await draftMessage({
    taskTitle: task.title,
    taskDescription: task.description || undefined,
    projectName: task.project?.name,
    targetPersonName: person.displayName,
    targetPersonHandle: person.handle,
    intent,
    channel,
    dueDate: task.dueAt || undefined,
  });

  if (!draft) {
    return json({ error: 'Failed to generate message draft' }, { status: 500 });
  }

  return json(draft);
};

