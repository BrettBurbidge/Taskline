import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/reports/overdue
// Returns tasks past their due date that are not completed or cancelled
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const tasks = await db.task.findMany({
    where: {
      userId,
      dueAt: { lt: new Date() },
      status: { notIn: ["completed", "cancelled"] },
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
    },
    orderBy: { dueAt: "asc" },
  });

  return json({ data: tasks, total: tasks.length });
};
