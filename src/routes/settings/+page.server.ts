import { error, fail } from "@sveltejs/kit";
import { db } from "$lib/db";
import crypto from "crypto";
import type { PageServerLoad, Actions } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const apiKeys = await db.apiKey.findMany({
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

  // Mask keys for display
  const maskedKeys = apiKeys.map(({ key, ...rest }) => ({
    ...rest,
    keyPrefix: key.slice(0, 8) + "..." + key.slice(-4),
  }));

  return { apiKeys: maskedKeys };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const userId = locals.user?.id;
    if (!userId) throw error(401, "Unauthorized");

    const formData = await request.formData();
    const name = (formData.get("name") as string) || "Default";

    const key = crypto.randomBytes(32).toString("hex");

    const apiKey = await db.apiKey.create({
      data: { userId, key, name },
      select: { id: true, name: true, key: true, createdAt: true },
    });

    return { newKey: apiKey.key, newKeyName: apiKey.name };
  },

  delete: async ({ request, locals }) => {
    const userId = locals.user?.id;
    if (!userId) throw error(401, "Unauthorized");

    const formData = await request.formData();
    const id = formData.get("id") as string;

    const existing = await db.apiKey.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) return fail(404, { error: "API key not found" });

    await db.apiKey.delete({ where: { id } });

    return { deleted: true };
  },
};
