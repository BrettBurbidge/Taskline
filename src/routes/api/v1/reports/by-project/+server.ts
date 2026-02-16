import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/reports/by-project
// Returns each project with task counts per status, plus an "unassigned" bucket
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const [projects, unassignedTasks] = await Promise.all([
    db.project.findMany({
      where: { userId },
      include: {
        tasks: {
          where: { userId },
          select: { status: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.task.findMany({
      where: { userId, projectId: null },
      select: { status: true },
    }),
  ]);

  const toCounts = (tasks: { status: string }[]) => ({
    not_started: tasks.filter((t) => t.status === "not_started").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    cancelled: tasks.filter((t) => t.status === "cancelled").length,
    total: tasks.length,
  });

  const data = projects.map(({ tasks, ...project }) => ({
    ...project,
    taskCounts: toCounts(tasks),
  }));

  return json({
    projects: data,
    unassigned: {
      id: null,
      name: "Unassigned",
      taskCounts: toCounts(unassignedTasks),
    },
  });
};
