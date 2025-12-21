import { db } from '$lib/db';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { dateStringToUTC } from '$lib/utils/timezone';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const task = await db.task.findFirst({
    where: { 
      id: params.id,
      userId, // Multi-tenant filter
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
      followUps: {
        include: {
          targetPerson: true,
        },
        orderBy: { dueAt: 'asc' },
      },
      followUpRules: true,
      contextNotes: {
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!task) {
    throw error(404, 'Task not found');
  }

  // Also fetch completed follow-ups for timeline
  const completedFollowUps = await db.followUp.findMany({
    where: {
      taskId: params.id,
      status: 'completed',
    },
    include: {
      targetPerson: true,
    },
    orderBy: {
      completedAt: 'asc',
    },
  });

  // Fetch available people and projects for editing (filtered by userId)
  const [people, projects] = await Promise.all([
    db.person.findMany({
      where: { userId },
      orderBy: { handle: 'asc' },
    }),
    db.project.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    task,
    people,
    projects,
    completedFollowUps,
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    // Verify task belongs to this user
    const existingTask = await db.task.findFirst({
      where: { 
        id: params.id,
        userId 
      },
    });

    if (!existingTask) {
      throw error(404, 'Task not found or access denied');
    }

    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const status = formData.get('status') as string;
    const dueAtString = formData.get('dueAt') as string;
    const projectId = formData.get('projectId') as string;
    const priority = formData.get('priority') as string;
    const executorPersonId = formData.get('executorPersonId') as string;
    const stakeholderPersonIdsStr = formData.get('stakeholderPersonIds') as string;
    const timezone = formData.get('timezone') as string;

    // Convert date string from user's timezone to UTC for storage
    let dueAt: Date | null = null;
    if (dueAtString && dueAtString.trim() !== '') {
      dueAt = dateStringToUTC(dueAtString, timezone || undefined);
    }

    // Parse stakeholder IDs
    const stakeholderPersonIds = stakeholderPersonIdsStr
      ? stakeholderPersonIdsStr.split(',').filter((id) => id.trim() !== '')
      : [];

    // Update task and stakeholders
    await db.task.update({
      where: { id: params.id },
      data: {
        title,
        description: description || null,
        status,
        dueAt,
        projectId: projectId || null,
        priority: priority || null,
        executorPersonId: executorPersonId || null,
        stakeholders: {
          deleteMany: {}, // Delete all existing stakeholders
          create: stakeholderPersonIds.map((personId) => ({
            personId,
          })),
        },
      },
    });

    return { success: true };
  },

  delete: async ({ params, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    // Verify task belongs to this user
    const task = await db.task.findFirst({
      where: { 
        id: params.id,
        userId 
      },
    });

    if (!task) {
      throw error(404, 'Task not found or access denied');
    }

    await db.task.delete({
      where: { id: params.id },
    });

    throw redirect(303, '/board');
  },

  addNote: async ({ request, params, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    // Verify task belongs to this user
    const task = await db.task.findFirst({
      where: { 
        id: params.id,
        userId 
      },
    });

    if (!task) {
      throw error(404, 'Task not found or access denied');
    }

    const formData = await request.formData();
    const content = formData.get('content') as string;

    if (content) {
      await db.contextNote.create({
        data: {
          content,
          taskId: params.id,
          noteType: 'general',
        },
      });
    }

    return { success: true };
  },
};

