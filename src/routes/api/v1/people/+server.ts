import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/people
// Query params: query (search handle/displayName/email)
export const GET: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const query = url.searchParams.get("query");

  const where: Record<string, unknown> = { userId };
  if (query) {
    where.OR = [
      { handle: { contains: query, mode: "insensitive" } },
      { displayName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const people = await db.person.findMany({
    where,
    orderBy: { handle: "asc" },
  });

  return json({ data: people, total: people.length });
};

// POST /api/v1/people
// Body: { handle, displayName, email?, source? }
export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const data = await request.json();

  if (!data.handle) throw error(400, "handle is required");
  if (!data.displayName) throw error(400, "displayName is required");

  const person = await db.person.create({
    data: {
      userId,
      handle: data.handle,
      displayName: data.displayName,
      email: data.email ?? null,
      source: data.source ?? "manual",
    },
  });

  return json(person, { status: 201 });
};
