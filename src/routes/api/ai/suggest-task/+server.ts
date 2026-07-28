import { json, error } from '@sveltejs/kit';
import { suggestTask, isAIAvailable } from '$lib/services/ai';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/ai/suggest-task - get AI suggestions for a task
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
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

  const { inputText, currentDate } = await request.json();

  // Fetch known people and projects for context (filtered by userId)
  const [people, projects] = await Promise.all([
    db.person.findMany({
      where: { userId },
      select: { handle: true, displayName: true },
      orderBy: { handle: 'asc' },
    }),
    db.project.findMany({
      where: { 
        userId,
        isActive: true 
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const suggestion = await suggestTask({
    inputText,
    currentDate: currentDate ? new Date(currentDate) : new Date(),
    userId,
    knownPeople: people,
    knownProjects: projects,
  });

  if (!suggestion) {
    return json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }

  // Map suggested handles and projects to IDs
  const result = {
    ...suggestion,
    suggestedExecutorId: suggestion.suggestedExecutor
      ? people.find((p) => `@${p.handle}` === suggestion.suggestedExecutor)?.handle
      : null,
    suggestedStakeholderIds: suggestion.suggestedStakeholders
      .map((handle) => people.find((p) => `@${p.handle}` === handle)?.handle)
      .filter(Boolean),
    suggestedProjectId: suggestion.suggestedProject
      ? projects.find((p) => p.name === suggestion.suggestedProject)?.id
      : null,
  };

  return json(result);
};

