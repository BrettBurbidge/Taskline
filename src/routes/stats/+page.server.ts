import { db } from "$lib/db";
import { error } from "@sveltejs/kit";

export const load = async ({ locals }: any) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  // One lean query serves all three reports: Closing pace (completed tasks),
  // Task mix / Leverage (completed + open), and Pushed down the road (open).
  const tasks = await db.task.findMany({
    where: {
      userId, // Multi-tenant filter
      status: { not: "cancelled" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      completedAt: true,
      taskType: true,
      estimatedMinutes: true,
      priority: true,
      projectId: true,
      accountablePersonId: true,
      executorPersonId: true,
      originalDueAt: true,
      dueAtChangeCount: true,
      boardDayCount: true,
    },
  });

  return { tasks };
};
