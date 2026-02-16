import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/reports/summary
// Returns task counts grouped by status
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const rows = await db.task.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {
    not_started: 0,
    in_progress: 0,
    waiting: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return json({ ...counts, total });
};
