import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/people/:id
export const GET: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const person = await db.person.findFirst({
    where: { id: params.id, userId },
    include: {
      accountableTasks: { select: { id: true, title: true, status: true } },
      executorTasks: { select: { id: true, title: true, status: true } },
    },
  });

  if (!person) throw error(404, "Person not found");

  return json(person);
};

// PATCH /api/v1/people/:id
// Body: any subset of { handle, displayName, email }
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const existing = await db.person.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) throw error(404, "Person not found");

  const data = await request.json();

  const person = await db.person.update({
    where: { id: params.id },
    data: {
      ...(data.handle !== undefined && { handle: data.handle }),
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.email !== undefined && { email: data.email }),
    },
  });

  return json(person);
};

// DELETE /api/v1/people/:id
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const existing = await db.person.findFirst({
    where: { id: params.id, userId },
    select: { id: true, handle: true },
  });

  if (!existing) throw error(404, "Person not found");

  if (existing.handle === "me") {
    throw error(400, "Cannot delete the 'me' person");
  }

  await db.person.delete({ where: { id: params.id } });

  return json({ success: true });
};
