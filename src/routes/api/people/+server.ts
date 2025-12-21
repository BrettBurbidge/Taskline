import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { RequestHandler } from './$types';

// GET /api/people - fetch all people (optionally filtered by query)
export const GET: RequestHandler = async ({ url, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const query = url.searchParams.get('query');

  const where: any = {
    userId, // Filter by user
  };
  
  if (query) {
    where.OR = [
      { handle: { contains: query, mode: 'insensitive' as const } },
      { displayName: { contains: query, mode: 'insensitive' as const } },
      { email: { contains: query, mode: 'insensitive' as const } },
    ];
  }

  const people = await db.person.findMany({
    where,
    orderBy: { handle: 'asc' },
  });

  return json(people);
};

// POST /api/people - create a new person
export const POST: RequestHandler = async ({ request, locals }) => {
  // Get authenticated user
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const data = await request.json();

  const person = await db.person.create({
    data: {
      userId, // Multi-tenant isolation
      handle: data.handle,
      displayName: data.displayName,
      email: data.email || null,
      source: data.source || 'manual',
    },
  });

  return json(person, { status: 201 });
};

