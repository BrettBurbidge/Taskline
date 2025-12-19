import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { dateStringToUTC } from '$lib/utils/timezone';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/move - move task to a different board date
export const POST: RequestHandler = async ({ params, request }) => {
  const { boardDate, timezone } = await request.json();

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || 'America/Denver';

  // Parse board date using timezone utilities
  let parsedBoardDate: Date | null = null;
  if (boardDate) {
    parsedBoardDate = dateStringToUTC(boardDate, tz);
  }

  const task = await db.task.update({
    where: { id: params.id },
    data: {
      boardDate: parsedBoardDate,
      sortOrder: null, // Reset sort order when moving
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: { person: true },
      },
    },
  });

  return json(task);
};

