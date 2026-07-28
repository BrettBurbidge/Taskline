import { json, error } from '@sveltejs/kit';
import { rewriteDraft, isAIAvailable } from '$lib/services/ai';
import type { RequestHandler } from './$types';

// POST /api/ai/rewrite-draft - rewrite an email draft with AI assistance
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

  const { subject, body, instruction } = await request.json();

  if (!body || !instruction) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = await rewriteDraft({
    currentSubject: subject || '',
    currentBody: body,
    instruction,
  });

  if (!result) {
    return json({ error: 'Failed to rewrite draft' }, { status: 500 });
  }

  return json(result);
};
