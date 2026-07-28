import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/projects — list projects with task counts
export const GET: RequestHandler = async ({ url, locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, "Unauthorized");

	const active = url.searchParams.get("active");
	const personal = url.searchParams.get("personal");
	const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
	const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

	const where: Record<string, unknown> = { userId };
	if (active === "true") where.isActive = true;
	else if (active === "false") where.isActive = false;

	// personal=false returns work projects only — what summaries should pull from
	if (personal === "true") where.isPersonal = true;
	else if (personal === "false") where.isPersonal = false;

	const [projects, total] = await Promise.all([
		db.project.findMany({
			where,
			orderBy: { name: "asc" },
			skip: offset,
			take: limit,
			include: {
				_count: {
					select: { tasks: true },
				},
			},
		}),
		db.project.count({ where }),
	]);

	return json({ data: projects, total, limit, offset });
};

// POST /api/v1/projects — create a new project
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, "Unauthorized");

	const body = await request.json();

	if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
		throw error(400, "name is required");
	}

	const project = await db.project.create({
		data: {
			userId,
			name: body.name.trim(),
			description: body.description || null,
			dueAt: body.dueAt ? new Date(body.dueAt) : null,
			isActive: body.isActive !== undefined ? body.isActive : true,
			isPersonal: body.isPersonal === true,
		},
		include: {
			_count: {
				select: { tasks: true },
			},
		},
	});

	return json(project, { status: 201 });
};
