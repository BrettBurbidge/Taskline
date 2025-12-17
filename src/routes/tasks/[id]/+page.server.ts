import { db } from '$lib/db';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { dateStringToUTC } from '$lib/utils/timezone';

export const load: PageServerLoad = async ({ params }) => {
  const task = await db.task.findUnique({
    where: { id: params.id },
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
    },
  });

  if (!task) {
    throw error(404, 'Task not found');
  }

  // Fetch available people and projects for editing
  const [people, projects] = await Promise.all([
    db.person.findMany({
      orderBy: { handle: 'asc' },
    }),
    db.project.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    task,
    people,
    projects,
  };
};

export const actions: Actions = {
  update: async ({ request, params }) => {
    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const status = formData.get('status') as string;
    const dueAtString = formData.get('dueAt') as string;
    const projectId = formData.get('projectId') as string;
    const priority = formData.get('priority') as string;
    const executorPersonId = formData.get('executorPersonId') as string;
    const timezone = formData.get('timezone') as string;

    // Convert date string from user's timezone to UTC for storage
    let dueAt: Date | null = null;
    if (dueAtString && dueAtString.trim() !== '') {
      dueAt = dateStringToUTC(dueAtString, timezone || undefined);
    }

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
      },
    });

    return { success: true };
  },

  delete: async ({ params }) => {
    await db.task.delete({
      where: { id: params.id },
    });

    throw redirect(303, '/board');
  },

  addNote: async ({ request, params }) => {
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

