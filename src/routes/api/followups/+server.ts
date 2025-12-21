import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// POST /api/followups - create a new follow-up
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  const body = await request.json();
  const { taskId, followUpType, targetPersonId, dueAt } = body;

  if (!taskId || !followUpType || !dueAt) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the task belongs to this user
  const task = await db.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw error(404, "Task not found or access denied");
  }

  // If targetPersonId is provided, verify it belongs to this user
  if (targetPersonId) {
    const person = await db.person.findFirst({
      where: {
        id: targetPersonId,
        userId,
      },
    });

    if (!person) {
      throw error(404, "Person not found or access denied");
    }
  }

  const followUp = await db.followUp.create({
    data: {
      taskId,
      followUpType,
      targetPersonId: targetPersonId || null,
      dueAt: new Date(dueAt),
      status: "pending",
    },
    include: {
      task: true,
      targetPerson: true,
    },
  });

  return json(followUp);
};
