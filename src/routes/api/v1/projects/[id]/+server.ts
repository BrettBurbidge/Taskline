import { json, error } from "@sveltejs/kit";
import { db } from "$lib/db";
import type { RequestHandler } from "./$types";

// GET /api/v1/projects/:id — single project with tasks and counts
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, "Unauthorized");

	const project = await db.project.findFirst({
		where: { id: params.id, userId },
		include: {
			tasks: {
				where: { userId },
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					title: true,
					status: true,
					priority: true,
					dueAt: true,
					createdAt: true,
				},
			},
		},
	});

	if (!project) throw error(404, "Project not found");

	const { tasks, ...rest } = project;
	const taskCounts = {
		not_started: tasks.filter((t) => t.status === "not_started").length,
		in_progress: tasks.filter((t) => t.status === "in_progress").length,
		waiting: tasks.filter((t) => t.status === "waiting").length,
		completed: tasks.filter((t) => t.status === "completed").length,
		cancelled: tasks.filter((t) => t.status === "cancelled").length,
		total: tasks.length,
	};

	return json({ ...rest, tasks, taskCounts });
};

// PATCH /api/v1/projects/:id — update project
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, "Unauthorized");

	const existing = await db.project.findFirst({
		where: { id: params.id, userId },
	});

	if (!existing) throw error(404, "Project not found");

	const body = await request.json();
	const data: Record<string, unknown> = {};

	if (body.name !== undefined) data.name = body.name;
	if (body.description !== undefined) data.description = body.description;
	if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
	if (body.isActive !== undefined) data.isActive = body.isActive;
	if (body.isPersonal !== undefined) data.isPersonal = body.isPersonal;

	const updated = await db.project.update({
		where: { id: params.id },
		data,
		include: {
			_count: {
				select: { tasks: true },
			},
		},
	});

	// When marking inactive, complete all pending follow-ups for this project's tasks
	if (body.isActive === false && existing.isActive === true) {
		const projectTasks = await db.task.findMany({
			where: { projectId: params.id, userId },
			select: { id: true },
		});
		const taskIds = projectTasks.map((t) => t.id);
		if (taskIds.length > 0) {
			await db.followUp.updateMany({
				where: { taskId: { in: taskIds }, status: "pending" },
				data: { status: "completed", completedAt: new Date() },
			});
		}
	}

	return json(updated);
};

// DELETE /api/v1/projects/:id — delete project, optionally reassign tasks
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, "Unauthorized");

	const existing = await db.project.findFirst({
		where: { id: params.id, userId },
		include: {
			_count: {
				select: { tasks: true },
			},
		},
	});

	if (!existing) throw error(404, "Project not found");

	// Parse optional moveToProjectId from body
	let moveToProjectId: string | null = null;
	try {
		const body = await request.json();
		moveToProjectId = body.moveToProjectId ?? null;
	} catch {
		// No body is fine — tasks will be unassigned
	}

	// Reassign tasks if any
	if (existing._count.tasks > 0) {
		await db.task.updateMany({
			where: { projectId: params.id, userId },
			data: { projectId: moveToProjectId },
		});
	}

	await db.project.delete({ where: { id: params.id } });

	return json({ success: true, tasksReassigned: existing._count.tasks });
};
