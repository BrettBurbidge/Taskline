import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import crypto from "crypto";
import type { RequestHandler } from "./$types";

// GET /api/v1/api-keys — list current user's API keys (masked)
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const keys = await db.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      key: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Mask keys — show only first 8 and last 4 characters
  const masked = keys.map(({ key, ...rest }) => ({
    ...rest,
    keyPrefix: key.slice(0, 8) + "..." + key.slice(-4),
  }));

  return json({ data: masked, total: masked.length });
};

// POST /api/v1/api-keys — generate a new API key
// Body: { name?: string }
export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const body = await request.json().catch(() => ({}));
  const name = body.name || "Default";

  const key = crypto.randomBytes(32).toString("hex");

  const apiKey = await db.apiKey.create({
    data: { userId, key, name },
    select: { id: true, name: true, key: true, createdAt: true },
  });

  // Return the full key — this is the only time it's shown in full
  return json(apiKey, { status: 201 });
};
