import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import { dateStringToUTC } from "$lib/utils/timezone";
import { generateForTask } from "$lib/services/followupEngine";
import type { RequestHandler } from "./$types";

// GET /api/tasks - fetch tasks with optional filters
export const GET: RequestHandler = async ({ url, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  const boardDate = url.searchParams.get("boardDate");
  const dueFrom = url.searchParams.get("dueFrom");
  const dueTo = url.searchParams.get("dueTo");
  const projectId = url.searchParams.get("projectId");

  const where: any = {
    userId, // Multi-tenant filter
  };

  if (boardDate) {
    where.boardDate = new Date(boardDate);
  }

  if (dueFrom || dueTo) {
    where.dueAt = {};
    if (dueFrom) where.dueAt.gte = new Date(dueFrom);
    if (dueTo) where.dueAt.lte = new Date(dueTo);
  }

  if (projectId) {
    where.projectId = projectId;
  }

  const tasks = await db.task.findMany({
    where,
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
      { boardDate: "asc" },
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
  });

  return json(tasks);
};

// POST /api/tasks - create a new task
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, "Unauthorized");
  }

  const data = await request.json();

  const {
    title,
    description,
    dueAt,
    projectId,
    accountablePersonId,
    executorPersonId,
    stakeholderPersonIds = [],
    boardDate,
    priority,
    timezone,
  } = data;

  // Get timezone for date conversion (fallback to default if not provided)
  const tz = timezone || process.env.DEFAULT_TIMEZONE || "America/Denver";

  // Parse dates using timezone utilities for consistency
  let parsedDueAt: Date | null = null;
  if (dueAt) {
    const dateStr = typeof dueAt === "string" ? dueAt : dueAt.toISOString();
    if (dateStr.includes("T")) {
      // Already has time component (ISO string)
      parsedDueAt = new Date(dateStr);
    } else {
      // Date-only string like "2025-12-15" - convert from user's timezone to UTC
      parsedDueAt = dateStringToUTC(dateStr, tz);
    }
  }

  let parsedBoardDate: Date | null = null;
  if (boardDate) {
    const dateStr =
      typeof boardDate === "string" ? boardDate : boardDate.toISOString();
    if (dateStr.includes("T")) {
      // Already has time component
      parsedBoardDate = new Date(dateStr);
    } else {
      // Date-only string - convert from user's timezone to UTC
      parsedBoardDate = dateStringToUTC(dateStr, tz);
    }
  }

  // Create the task
  const task = await db.task.create({
    data: {
      userId, // Multi-tenant isolation
      title,
      description,
      dueAt: parsedDueAt,
      projectId: projectId || null,
      accountablePersonId,
      executorPersonId: executorPersonId || accountablePersonId,
      boardDate: parsedBoardDate,
      priority: priority || null,
      status: "not_started",
      stakeholders: {
        create: stakeholderPersonIds.map((personId: string) => ({
          personId,
        })),
      },
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
  });

  // Auto-generate follow-ups for the newly created task
  try {
    await generateForTask(task.id, userId, new Date(), tz);
  } catch (error) {
    // Log error but don't fail task creation
    console.error("Failed to auto-generate follow-ups:", error);
  }

  return json(task, { status: 201 });
};
