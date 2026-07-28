import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { summarizeTaskMix } from "$lib/services/taskMix";
import type { RequestHandler } from "./$types";

// GET /api/v1/reports/task-mix
// What kind of work this user does (task types, leverage rollup, indicators).
//
// Query params:
//   days       — optional window on completed tasks, e.g. ?days=90 (all time if omitted)
//   timezone   — optional IANA zone used to compare calendar days
//                (defaults to DEFAULT_TIMEZONE, same fallback as the task endpoints)
//   population — 'completed' (default) or 'open' (snapshot of everything not done;
//                ignores days)
export const GET: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const daysParam = url.searchParams.get("days");
  let windowDays: number | undefined;
  if (daysParam !== null) {
    const parsed = parseInt(daysParam, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw error(400, "days must be a positive integer");
    }
    windowDays = parsed;
  }

  const timezone =
    url.searchParams.get("timezone") ||
    process.env.DEFAULT_TIMEZONE ||
    "America/Denver";

  const population = url.searchParams.get("population") || "completed";
  if (population !== "completed" && population !== "open") {
    throw error(400, "population must be 'completed' or 'open'");
  }

  // Fetch all non-cancelled tasks (not just the population) so the fallback
  // minute medians see every real estimate — matching the stats page exactly.
  const tasks = await db.task.findMany({
    where: { userId, status: { not: "cancelled" } },
    select: {
      status: true,
      completedAt: true,
      taskType: true,
      estimatedMinutes: true,
      priority: true,
      projectId: true,
      accountablePersonId: true,
      executorPersonId: true,
    },
  });

  const summary = summarizeTaskMix(tasks, { population, timezone, windowDays });

  return json({
    ...summary,
    population,
    windowDays: windowDays ?? null,
    timezone,
  });
};
