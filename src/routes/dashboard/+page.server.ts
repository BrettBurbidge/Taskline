import { db } from "$lib/db";
import { error } from "@sveltejs/kit";

export const load = async ({ locals }: any) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  // Fetch all tasks with relations (filtered by userId)
  const tasks = await db.task.findMany({
    where: {
      userId, // Multi-tenant filter
      status: { notIn: ["cancelled"] }, // Exclude cancelled tasks
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
      stakeholders: {
        include: {
          person: true,
        },
      },
    },
    orderBy: [
      { status: "asc" }, // Group by status
      { dueAt: "asc" }, // Then by due date
      { createdAt: "desc" }, // Then by creation date
    ],
  });

  // Get all projects for filter (filtered by userId)
  const projects = await db.project.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  // Get all people for filter (filtered by userId)
  const people = await db.person.findMany({
    where: { userId },
    orderBy: { displayName: "asc" },
  });

  // Calculate stats
  const stats = {
    total: tasks.length,
    notStarted: tasks.filter((t) => t.status === "not_started").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  return {
    tasks,
    projects,
    people,
    stats,
  };
};
