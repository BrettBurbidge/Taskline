import { json, error } from '@sveltejs/kit';
import { transcribeAudioAndExtractTasks, isTranscriptionAvailable } from '$lib/services/ai';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/ai/transcribe-audio - transcribe audio and extract tasks
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  if (!isTranscriptionAvailable()) {
    return json(
      { error: 'Voice capture not configured. Set ANTHROPIC_API_KEY and OPENAI_API_KEY (Whisper).' },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const currentDateStr = formData.get('currentDate') as string;

    if (!audioFile) {
      return json({ error: 'No audio file provided' }, { status: 400 });
    }

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

    const result = await transcribeAudioAndExtractTasks({
      audioFile,
      currentDate: currentDateStr ? new Date(currentDateStr) : new Date(),
      userId,
      knownPeople: people,
      knownProjects: projects,
    });

    if (!result) {
      return json({ error: 'Failed to transcribe audio or extract tasks' }, { status: 500 });
    }

    return json(result);
  } catch (error) {
    console.error('Audio transcription endpoint error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Failed to process audio' },
      { status: 500 }
    );
  }
};





