import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// POST /api/tasks/:id/move - move task to a different board date
export const POST: RequestHandler = async ({ params, request }) => {
  const { boardDate } = await request.json();

  // Parse board date at noon local time to avoid timezone issues
  let parsedBoardDate: Date | null = null;
  if (boardDate) {
    const [year, month, day] = boardDate.split('-').map(Number);
    parsedBoardDate = new Date(year, month - 1, day, 12, 0, 0, 0);
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

