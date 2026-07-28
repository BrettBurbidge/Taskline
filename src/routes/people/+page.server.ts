import { db } from '$lib/db';
import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;

  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const [people, tasks] = await Promise.all([
    db.person.findMany({
      where: { userId }, // Multi-tenant filter
      orderBy: { handle: 'asc' },
      include: {
        _count: {
          select: {
            accountableTasks: true,
            executorTasks: true,
            stakeholderOn: true,
          },
        },
      },
    }),
    // Everything needed to count open/closed tasks per person in one pass.
    // Cancelled tasks are excluded to match the person detail page.
    db.task.findMany({
      where: {
        userId,
        status: { notIn: ['cancelled'] },
      },
      select: {
        status: true,
        accountablePersonId: true,
        executorPersonId: true,
        stakeholders: { select: { personId: true } },
      },
    }),
  ]);

  // A person can be accountable, executor and stakeholder on the same task —
  // dedupe so it only counts once for them.
  const taskCounts = new Map<string, { open: number; closed: number }>();

  for (const task of tasks) {
    const personIds = new Set<string>();
    personIds.add(task.accountablePersonId);
    if (task.executorPersonId) personIds.add(task.executorPersonId);
    for (const stakeholder of task.stakeholders) personIds.add(stakeholder.personId);

    const bucket = task.status === 'completed' ? 'closed' : 'open';

    for (const personId of personIds) {
      const counts = taskCounts.get(personId) ?? { open: 0, closed: 0 };
      counts[bucket] += 1;
      taskCounts.set(personId, counts);
    }
  }

  return {
    people: people.map((person) => ({
      ...person,
      taskCounts: taskCounts.get(person.id) ?? { open: 0, closed: 0 },
    })),
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    const formData = await request.formData();
    const handle = (formData.get('handle') as string).toLowerCase().trim();
    const displayName = formData.get('displayName') as string;
    const email = formData.get('email') as string;

    if (!handle || !displayName) {
      return fail(400, { error: 'Handle and display name are required' });
    }

    // Check if handle already exists for this user
    const existing = await db.person.findFirst({ 
      where: { 
        userId,
        handle 
      } 
    });
    if (existing) {
      return fail(400, { error: 'Handle already exists' });
    }

    await db.person.create({
      data: {
        userId, // Multi-tenant isolation
        handle,
        displayName,
        email: email || null,
        source: 'manual',
      },
    });

    return { success: true };
  },

  update: async ({ request, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;
    const displayName = formData.get('displayName') as string;
    const email = formData.get('email') as string;

    // Verify person belongs to this user
    const person = await db.person.findFirst({
      where: { 
        id,
        userId 
      },
    });

    if (!person) {
      return fail(404, { error: 'Person not found or access denied' });
    }

    await db.person.update({
      where: { id },
      data: {
        displayName,
        email: email || null,
      },
    });

    return { success: true };
  },

  delete: async ({ request, locals }) => {
    // Get authenticated user
    const userId = locals.user?.id;

    if (!userId) {
      throw error(401, 'Unauthorized');
    }

    const formData = await request.formData();
    const id = formData.get('id') as string;

    // Check if person belongs to this user and is used in any tasks
    const person = await db.person.findFirst({
      where: { 
        id,
        userId 
      },
      include: {
        _count: {
          select: {
            accountableTasks: true,
            executorTasks: true,
            stakeholderOn: true,
          },
        },
      },
    });

    if (person && (person._count.accountableTasks > 0 || person._count.executorTasks > 0 || person._count.stakeholderOn > 0)) {
      return fail(400, { error: 'Cannot delete person who is assigned to tasks' });
    }

    await db.person.delete({
      where: { id },
    });

    return { success: true };
  },
};

