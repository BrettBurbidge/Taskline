import { json } from '@sveltejs/kit';
import { isAIAvailable } from '$lib/services/ai';
import type { RequestHandler } from './$types';

// GET /api/ai/status - check if AI is available
export const GET: RequestHandler = async () => {
  return json({
    available: isAIAvailable(),
    message: isAIAvailable()
      ? 'AI assistance is available'
      : 'Set OPENAI_API_KEY to enable AI features',
  });
};

