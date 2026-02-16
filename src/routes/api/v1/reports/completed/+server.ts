import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

type GroupBy = "day" | "week" | "month";

function periodKey(date: Date, groupBy: GroupBy): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  if (groupBy === "day") return `${y}-${m}-${d}`;
  if (groupBy === "month") return `${y}-${m}`;

  // ISO week: find Monday of the week
  const day = date.getUTCDay() || 7; // treat Sunday as 7
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  const wy = monday.getUTCFullYear();
  const wm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const wd = String(monday.getUTCDate()).padStart(2, "0");
  return `${wy}-${wm}-${wd}`;
}

// GET /api/v1/reports/completed
// Query params: groupBy=day|week|month (default "day")
// Returns tasks completed in the last 30 days / 12 weeks / 12 months
export const GET: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const groupBy = (url.searchParams.get("groupBy") ?? "day") as GroupBy;
  if (!["day", "week", "month"].includes(groupBy)) {
    throw error(400, "groupBy must be one of: day, week, month");
  }

  const now = new Date();
  let since: Date;
  if (groupBy === "day") {
    since = new Date(now);
    since.setUTCDate(now.getUTCDate() - 30);
  } else if (groupBy === "week") {
    since = new Date(now);
    since.setUTCDate(now.getUTCDate() - 7 * 12);
  } else {
    since = new Date(now);
    since.setUTCMonth(now.getUTCMonth() - 12);
  }

  const tasks = await db.task.findMany({
    where: {
      userId,
      status: "completed",
      completedAt: { gte: since },
    },
    select: { id: true, title: true, completedAt: true, projectId: true },
    orderBy: { completedAt: "desc" },
  });

  // Group by period
  const groups: Record<string, { period: string; count: number; taskIds: string[] }> = {};
  for (const task of tasks) {
    const key = periodKey(task.completedAt ?? new Date(), groupBy);
    if (!groups[key]) groups[key] = { period: key, count: 0, taskIds: [] };
    groups[key].count++;
    groups[key].taskIds.push(task.id);
  }

  const periods = Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));

  return json({ groupBy, total: tasks.length, periods });
};
