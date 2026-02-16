import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { generateForTask } from "$lib/services/followupEngine";
import type { RequestHandler } from "./$types";

const TASK_INCLUDE = {
  project: true,
  accountablePerson: true,
  executorPerson: true,
  stakeholders: {
    include: { person: true },
  },
  followUps: {
    include: { targetPerson: true },
    orderBy: { dueAt: "asc" as const },
  },
  contextNotes: {
    orderBy: { createdAt: "desc" as const },
  },
} as const;

// GET /api/v1/tasks/:id
export const GET: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const task = await db.task.findFirst({
    where: { id: params.id, userId },
    include: TASK_INCLUDE,
  });

  if (!task) throw error(404, "Task not found");

  return json(task);
};

// PATCH /api/v1/tasks/:id
// Body: any subset of task fields
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const data = await request.json();

  const existing = await db.task.findFirst({
    where: { id: params.id, userId },
    select: { id: true, dueAt: true },
  });

  if (!existing) throw error(404, "Task not found");

  const task = await db.task.update({
    where: { id: params.id, userId },
    data: {
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      boardDate: data.boardDate ? new Date(data.boardDate) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    },
    include: TASK_INCLUDE,
  });

  // Regenerate follow-ups if due date changed
  const newDueAt = data.dueAt ? new Date(data.dueAt).getTime() : null;
  const oldDueAt = existing.dueAt ? new Date(existing.dueAt).getTime() : null;
  if (newDueAt !== oldDueAt) {
    try {
      await generateForTask(task.id, userId, new Date(), data.timezone);
    } catch (err) {
      console.error("Failed to regenerate follow-ups:", err);
    }
  }

  return json(task);
};

// DELETE /api/v1/tasks/:id
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const existing = await db.task.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) throw error(404, "Task not found");

  await db.task.delete({ where: { id: params.id, userId } });

  return json({ success: true });
};
