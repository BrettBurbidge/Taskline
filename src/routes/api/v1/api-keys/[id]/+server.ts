import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// DELETE /api/v1/api-keys/:id — revoke an API key
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const existing = await db.apiKey.findFirst({
    where: { id: params.id, userId },
    select: { id: true },
  });

  if (!existing) throw error(404, "API key not found");

  await db.apiKey.delete({ where: { id: params.id } });

  return json({ success: true });
};
