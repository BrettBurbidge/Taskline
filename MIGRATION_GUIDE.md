# Database Query Migration Guide

This guide explains how to update all database queries to filter by `userId` for multi-tenant isolation.

## Overview

With the new multi-tenant architecture, **all queries must be scoped to the current user**. This prevents users from accessing each other's data.

## Pattern to Follow

### Before (Single-user)
```typescript
const tasks = await db.task.findMany({
  where: {
    status: 'not_started',
  },
});
```

### After (Multi-tenant)
```typescript
const userId = event.locals.user?.id; // Get from auth session

if (!userId) {
  throw error(401, 'Unauthorized');
}

const tasks = await db.task.findMany({
  where: {
    userId, // Add userId filter
    status: 'not_started',
  },
});
```

## Files That Need Updating

### ✅ Priority 1: API Routes (Most Critical)

These files handle data mutations and must be updated first:

- [ ] `/src/routes/api/tasks/+server.ts` (POST - create task)
- [ ] `/src/routes/api/tasks/[id]/+server.ts` (GET, PATCH, DELETE)
- [ ] `/src/routes/api/tasks/[id]/complete/+server.ts` (POST)
- [ ] `/src/routes/api/tasks/[id]/move/+server.ts` (POST)
- [ ] `/src/routes/api/tasks/[id]/reorder/+server.ts` (POST)
- [ ] `/src/routes/api/projects/+server.ts` (GET, POST)
- [ ] `/src/routes/api/projects/[id]/+server.ts` (GET, PATCH, DELETE)
- [ ] `/src/routes/api/people/+server.ts` (GET, POST)
- [ ] `/src/routes/api/people/[handle]/+server.ts` (GET, PATCH)
- [ ] `/src/routes/api/followups/generate/+server.ts` (POST)
- [ ] `/src/routes/api/followups/[id]/complete/+server.ts` (POST)
- [ ] `/src/routes/api/followups/[id]/snooze/+server.ts` (POST)
- [ ] `/src/routes/api/board/rollover/+server.ts` (POST)
- [ ] `/src/routes/api/ai/parse-task/+server.ts` (POST)

### ✅ Priority 2: Page Server Loaders

These files load data for pages:

- [ ] `/src/routes/board/+page.server.ts`
- [ ] `/src/routes/inbox/+page.server.ts`
- [ ] `/src/routes/week/+page.server.ts`
- [ ] `/src/routes/day/[date]/+page.server.ts`
- [ ] `/src/routes/tasks/[id]/+page.server.ts`
- [ ] `/src/routes/projects/+page.server.ts`
- [ ] `/src/routes/projects/[id]/+page.server.ts`
- [ ] `/src/routes/people/+page.server.ts`
- [ ] `/src/routes/people/[handle]/+page.server.ts`
- [ ] `/src/routes/completed/+page.server.ts`

### ✅ Priority 3: Services

- [ ] `/src/lib/services/followupEngine.ts`
- [ ] `/src/lib/services/ai.ts`

## Step-by-Step Update Process

### 1. Update API Routes

For each API route file:

```typescript
// Example: /src/routes/api/tasks/+server.ts

import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/db';

export const GET: RequestHandler = async ({ locals }) => {
  // 1. Get userId from authenticated session
  const userId = locals.user?.id;
  
  // 2. Check authentication
  if (!userId) {
    throw error(401, 'Unauthorized');
  }
  
  // 3. Add userId filter to all queries
  const tasks = await db.task.findMany({
    where: {
      userId, // ← Add this
      status: { notIn: ['cancelled'] },
    },
    include: {
      project: true,
      accountablePerson: true,
      executorPerson: true,
    },
  });
  
  return json(tasks);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Get userId
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }
  
  const data = await request.json();
  
  // 2. Ensure userId is always set when creating records
  const task = await db.task.create({
    data: {
      userId, // ← Add this to all creates
      title: data.title,
      description: data.description,
      // ... other fields
    },
  });
  
  return json(task, { status: 201 });
};
```

### 2. Update Page Loaders

For each `+page.server.ts` file:

```typescript
// Example: /src/routes/board/+page.server.ts

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/db';

export const load: PageServerLoad = async ({ locals }) => {
  // 1. Get userId
  const userId = locals.user?.id;
  
  if (!userId) {
    throw error(401, 'Unauthorized');
  }
  
  // 2. Filter all queries by userId
  const tasks = await db.task.findMany({
    where: {
      userId, // ← Add this
      boardDate: today,
      status: { in: ['not_started', 'in_progress', 'waiting'] },
    },
  });
  
  const projects = await db.project.findMany({
    where: {
      userId, // ← Add this
      isActive: true,
    },
  });
  
  return {
    tasks,
    projects,
  };
};
```

### 3. Update Related Queries

When querying related data through relations, ensure parent records are filtered by userId:

```typescript
// Get a task (already filtered by userId)
const task = await db.task.findUnique({
  where: {
    id: taskId,
    userId, // ← Add this for security
  },
  include: {
    followUps: true, // These are automatically scoped through the task relation
    stakeholders: {
      include: {
        person: true, // Person also needs userId check
      },
    },
  },
});

// If person is accessed separately, verify it belongs to the user
const person = await db.person.findUnique({
  where: {
    id: personId,
    userId, // ← Add this
  },
});
```

### 4. Update Service Functions

Services like `followupEngine.ts` need userId passed as a parameter:

```typescript
// Before
export async function generateForTask(taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  // ...
}

// After
export async function generateForTask(taskId: string, userId: string) {
  const task = await db.task.findUnique({
    where: {
      id: taskId,
      userId, // ← Add this
    },
  });
  // ...
}
```

## Common Patterns

### Pattern 1: findMany with filters
```typescript
await db.task.findMany({
  where: {
    userId, // Always first!
    status: 'completed',
    dueAt: { lte: someDate },
  },
});
```

### Pattern 2: findUnique with composite key
```typescript
await db.task.findUnique({
  where: {
    id: taskId,
    userId, // Add for security verification
  },
});
```

### Pattern 3: create with userId
```typescript
await db.task.create({
  data: {
    userId, // Always include!
    title: 'New task',
    // ... other fields
  },
});
```

### Pattern 4: update with userId verification
```typescript
await db.task.update({
  where: {
    id: taskId,
    userId, // Verify ownership
  },
  data: {
    title: 'Updated title',
  },
});
```

### Pattern 5: delete with userId verification
```typescript
await db.task.delete({
  where: {
    id: taskId,
    userId, // Verify ownership
  },
});
```

## Testing Checklist

After updating queries, test these scenarios:

- [ ] User can only see their own tasks
- [ ] User can only see their own projects
- [ ] User can only see their own people/contacts
- [ ] User cannot access another user's task by ID
- [ ] User cannot update another user's data
- [ ] User cannot delete another user's data
- [ ] Creating new records automatically assigns correct userId
- [ ] Related queries (through relations) respect userId boundaries

## Common Mistakes to Avoid

❌ **Forgetting userId in WHERE clause**
```typescript
// Wrong - exposes all users' data
const tasks = await db.task.findMany({
  where: { status: 'completed' }
});
```

✅ **Always include userId**
```typescript
// Correct - scoped to user
const tasks = await db.task.findMany({
  where: {
    userId,
    status: 'completed'
  }
});
```

❌ **Not checking authentication**
```typescript
// Wrong - no auth check
export const GET: RequestHandler = async () => {
  const tasks = await db.task.findMany();
  return json(tasks);
};
```

✅ **Always check authentication first**
```typescript
// Correct - verify auth
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, 'Unauthorized');
  
  const tasks = await db.task.findMany({ where: { userId } });
  return json(tasks);
};
```

## Example Pull Request

See the example implementation in these key files:

1. `/src/routes/api/tasks/+server.ts` - Shows POST/GET with userId
2. `/src/routes/board/+page.server.ts` - Shows page loader with userId
3. `/src/lib/services/followupEngine.ts` - Shows service function with userId

## Need Help?

If you encounter issues:
1. Check that userId is defined and not null
2. Verify the user is authenticated (`locals.user` exists)
3. Ensure Prisma schema has userId fields on all tenant-specific models
4. Test with multiple user accounts to verify isolation

