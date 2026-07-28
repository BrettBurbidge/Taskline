import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { summarizePunctuality } from "$lib/services/punctuality";
import type { RequestHandler } from "./$types";

// GET /api/v1/reports/punctuality
// How far from their due date this user's tasks actually get closed.
//
// Query params:
//   days     — optional window, e.g. ?days=90 for the last 90 days (all time if omitted)
//   timezone — optional IANA zone used to compare calendar days
//              (defaults to DEFAULT_TIMEZONE, same fallback as the task endpoints)
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

  const tasks = await db.task.findMany({
    where: { userId, status: "completed" },
    select: { status: true, dueAt: true, completedAt: true },
  });

  const summary = summarizePunctuality(tasks, timezone, windowDays);

  return json({
    ...summary,
    windowDays: windowDays ?? null,
    timezone,
  });
};
