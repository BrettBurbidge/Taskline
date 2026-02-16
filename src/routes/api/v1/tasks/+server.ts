import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { dateStringToUTC } from "$lib/utils/timezone";
import { generateForTask } from "$lib/services/followupEngine";
import type { RequestHandler } from "./$types";

const TASK_INCLUDE = {
  project: true,
  accountablePerson: true,
  executorPerson: true,
  stakeholders: {
    include: { person: true },
  },
} as const;

// GET /api/v1/tasks
// Query params: status, projectId, limit (default 100), offset (default 0)
export const GET: RequestHandler = async ({ url, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const status = url.searchParams.get("status");
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;
  if (projectId) where.projectId = projectId;

  const [tasks, total] = await Promise.all([
    db.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: [{ boardDate: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    db.task.count({ where }),
  ]);

  return json({ data: tasks, total, limit, offset });
};

// POST /api/v1/tasks
// Body: { title, description?, status?, priority?, dueAt?, boardDate?,
//         projectId?, accountablePersonId?, executorPersonId? }
export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const data = await request.json();
  const {
    title,
    description,
    status,
    priority,
    dueAt,
    boardDate,
    projectId,
    executorPersonId,
    timezone,
  } = data;
  let { accountablePersonId } = data;

  if (!title) throw error(400, "title is required");

  const tz = timezone || process.env.DEFAULT_TIMEZONE || "America/Denver";

  // Default accountablePerson to the user's "me" person if not provided
  if (!accountablePersonId) {
    const me = await db.person.findFirst({ where: { userId, handle: "me" } });
    if (!me) throw error(422, "No 'me' person found for this user — run prisma db seed first");
    accountablePersonId = me.id;
  }

  const parsedDueAt = dueAt
    ? dueAt.includes("T") ? new Date(dueAt) : dateStringToUTC(dueAt, tz)
    : null;

  const parsedBoardDate = boardDate
    ? boardDate.includes("T") ? new Date(boardDate) : dateStringToUTC(boardDate, tz)
    : null;

  const task = await db.task.create({
    data: {
      userId,
      title,
      description: description ?? null,
      status: status ?? "not_started",
      priority: priority ?? null,
      dueAt: parsedDueAt,
      boardDate: parsedBoardDate,
      projectId: projectId ?? null,
      accountablePersonId,
      executorPersonId: executorPersonId ?? accountablePersonId,
    },
    include: TASK_INCLUDE,
  });

  try {
    await generateForTask(task.id, userId, new Date(), tz);
  } catch (err) {
    console.error("Failed to auto-generate follow-ups:", err);
  }

  return json(task, { status: 201 });
};
