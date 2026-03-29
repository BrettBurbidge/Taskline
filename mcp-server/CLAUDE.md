# Taskline MCP Server — Build Guide

This document gives Claude Code everything needed to build a standalone MCP (Model Context Protocol) server for Taskline. The server lives in this `mcp-server/` directory and communicates with a running Taskline instance over its REST API using an API key. It has zero dependency on the Taskline app's internal code (no SvelteKit, no Prisma, no `$lib` imports).

---

## What This Builds

**Part 1 — Taskline app changes:** Add API key support to the Taskline SvelteKit app so that `Authorization: Bearer tl_...` tokens are accepted on all API routes.

**Part 2 — MCP server:** A Node.js/TypeScript MCP server that authenticates with a single `TASKLINE_API_KEY` env var and exposes:
- **20 tools** — create/read/update/delete tasks, follow-ups, projects, people; board operations; AI drafting
- **4 resources** — read-only views of board, projects, people, and task detail

---

## Part 1: Taskline App Changes Required

The Taskline app currently only accepts Supabase JWTs. Three changes are needed to support API keys.

### 1a. New Prisma Model — `ApiKey`

Add to `prisma/schema.prisma` (inside the User section):

```prisma
model ApiKey {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  name        String                          // human label e.g. "Claude Code"
  keyHash     String    @unique @map("key_hash")  // SHA-256 hash of the raw key
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("api_key")
}
```

Also add the relation to the `User` model:
```prisma
apiKeys  ApiKey[]
```

Then run:
```bash
npx prisma migrate dev --name add_api_keys
npx prisma generate
```

### 1b. API Key Generation Utility

Create `src/lib/server/apiKeys.ts`:

```typescript
import { createHash, randomBytes } from 'crypto';

// Generate a new raw API key: "tl_" + 32 random bytes as hex = 67 chars total
export function generateApiKey(): string {
  return 'tl_' + randomBytes(32).toString('hex');
}

// Hash a raw key for storage — never store the raw key
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
```

### 1c. New REST Endpoint — `/api/api-keys`

Create `src/routes/api/api-keys/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { generateApiKey, hashApiKey } from '$lib/server/apiKeys';

// GET /api/api-keys — list all keys for the authenticated user (never returns raw key)
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await db.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return json(keys);
};

// POST /api/api-keys — create a new key; returns the raw key ONCE
export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== 'string') {
    return json({ error: 'name is required' }, { status: 400 });
  }

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);

  const record = await db.apiKey.create({
    data: { userId, name, keyHash },
    select: { id: true, name: true, createdAt: true },
  });

  // Return the raw key only once — it cannot be retrieved again
  return json({ ...record, key: rawKey }, { status: 201 });
};
```

Create `src/routes/api/api-keys/[id]/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';

// DELETE /api/api-keys/:id — revoke a key
export const DELETE: RequestHandler = async ({ params, locals }) => {
  const userId = locals.user?.id;
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const key = await db.apiKey.findFirst({ where: { id: params.id, userId } });
  if (!key) return json({ error: 'Not found' }, { status: 404 });

  await db.apiKey.delete({ where: { id: params.id } });
  return json({ success: true });
};
```

### 1d. Update `hooks.server.ts`

Update the auth middleware to detect API keys **before** falling back to Supabase JWT auth. API keys have the `tl_` prefix so they're easy to distinguish.

In `src/hooks.server.ts`, replace the existing handle function with this updated version:

```typescript
import { createSupabaseServerClient, getUser } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/db";
import { hashApiKey } from "$lib/server/apiKeys";
import { createHash } from "crypto";

export const handle: Handle = async ({ event, resolve }) => {
  // --- API Key Auth ---
  // Check for API key before Supabase session.
  // API keys look like: Authorization: Bearer tl_<64 hex chars>
  const authHeader = event.request.headers.get('authorization');
  const rawKey = authHeader?.startsWith('Bearer tl_')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (rawKey) {
    const keyHash = hashApiKey(rawKey);
    const apiKey = await db.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (apiKey) {
      // Set locals.user to match the shape set by Supabase auth
      event.locals.user = { id: apiKey.userId, email: apiKey.user.email };
      // Update last used timestamp (fire and forget — don't await)
      db.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});
    }
    // Note: if API key is invalid, locals.user stays null → 401 below
  }

  // --- Supabase Session Auth (for browser sessions) ---
  if (!event.locals.user) {
    event.locals.supabase = createSupabaseServerClient(event);
    event.locals.user = await getUser(event);

    // Sync user to database on first login
    if (event.locals.user) {
      try {
        await db.user.upsert({
          where: { id: event.locals.user.id },
          create: { id: event.locals.user.id, email: event.locals.user.email || "" },
          update: { email: event.locals.user.email || "" },
        });

        const existingPerson = await db.person.findFirst({
          where: { userId: event.locals.user.id, handle: "me" },
        });

        if (!existingPerson) {
          const emailName = event.locals.user.email?.split("@")[0] || "Me";
          const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
          await db.person.create({
            data: {
              userId: event.locals.user.id,
              handle: "me",
              displayName,
              email: event.locals.user.email || null,
              source: "auto",
            },
          });
        }
      } catch (err) {
        console.error("Failed to sync user to database:", err);
      }
    }
  }

  // --- Route Protection (unchanged) ---
  const protectedPaths = ["/board", "/inbox", "/week", "/day", "/tasks", "/projects", "/people", "/completed"];
  const isProtectedApiRoute = event.url.pathname.startsWith("/api") && !event.url.pathname.startsWith("/auth");
  const isProtectedPath = protectedPaths.some((p) => event.url.pathname.startsWith(p)) || isProtectedApiRoute;
  const isAuthPath = event.url.pathname.startsWith("/auth");

  if (isProtectedPath && !event.locals.user) {
    if (isProtectedApiRoute) {
      // Return 401 JSON for API routes instead of redirecting
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw redirect(303, "/auth/login");
  }

  if (isAuthPath && event.locals.user && event.url.pathname !== "/auth/logout") {
    throw redirect(303, "/board");
  }

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });

  return response;
};
```

> **Important change:** For API routes with an invalid/missing token, return a `401 JSON` response instead of redirecting to `/auth/login`. The current code redirects, which would confuse the MCP client. The check `if (isProtectedApiRoute)` handles this.

### 1e. Getting Your API Key

Once the above changes are deployed, generate a key via curl or from the app:

```bash
# From a logged-in browser session (copy cookie from DevTools):
curl -X POST https://your-app.vercel.app/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"name": "Claude Code"}'

# Response (save the key — shown only once):
# { "id": "uuid", "name": "Claude Code", "createdAt": "...", "key": "tl_abc123..." }
```

---

## Part 2: MCP Server

### File Structure

```
mcp-server/
├── CLAUDE.md              ← this file
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           ← entry point, server bootstrap, tool/resource wiring
    ├── client.ts          ← TasklineClient class: auth + all HTTP methods + type interfaces
    ├── resources.ts       ← 4 MCP resources
    └── tools/
        ├── registry.ts    ← shared ToolDef type and toolRegistry array
        ├── tasks.ts       ← 8 tools
        ├── followups.ts   ← 5 tools
        ├── projects.ts    ← 4 tools
        ├── people.ts      ← 2 tools
        ├── board.ts       ← 2 tools
        └── ai.ts          ← 2 tools (optional, gated on AI availability)
```

### `package.json`

```json
{
  "name": "@taskline/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Taskline task management",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

> **Note:** No `@supabase/supabase-js` — API key auth needs only native `fetch`. Use `zod` v3 (not v4). `"type": "module"` is required — the MCP SDK is ESM-only.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> **Critical:** `module: "NodeNext"` + `moduleResolution: "NodeNext"` requires `.js` extensions on all imports, even when the source is `.ts`. Write `import { foo } from './client.js'` not `'./client'`.

### `.env.example`

```
TASKLINE_URL=http://localhost:5173
TASKLINE_API_KEY=tl_your_api_key_here
```

### `.gitignore`

```
node_modules/
dist/
.env
```

---

## Authentication Design

**File:** `src/client.ts`

The API key is a static token — no refresh, no expiry logic needed. Just pass it as a Bearer token on every request.

```typescript
export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class TasklineClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      throw new Error('API key is invalid or expired. Check TASKLINE_API_KEY.');
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }
}
```

After defining `request()`, add all API methods as instance methods grouped by domain:

```typescript
// ---- Tasks ----
listTasks(params?: { boardDate?: string; dueFrom?: string; dueTo?: string; projectId?: string })
getTask(id: string)
createTask(data: CreateTaskInput)
updateTask(id: string, data: Partial<CreateTaskInput & { status: string }>)
deleteTask(id: string)
completeTask(id: string)
moveTask(id: string, boardDate: string, timezone?: string)
reorderTask(id: string, direction: 'up' | 'down', targetDate?: string, timezone?: string)
generateFollowupsForTask(id: string, timezone?: string)

// ---- Follow-Ups ----
createFollowup(data: CreateFollowupInput)
generateFollowups(boardDate?: string, timezone?: string)
getFollowup(id: string)
completeFollowup(id: string, notes?: string)
snoozeFollowup(id: string, until: string)
deleteFollowup(id: string)

// ---- Projects ----
listProjects()
createProject(data: { name: string; description?: string; dueAt?: string })
updateProject(id: string, data: { name?: string; description?: string; isActive?: boolean })
deleteProject(id: string, moveToProjectId?: string)

// ---- People ----
listPeople(query?: string)
createPerson(data: { handle: string; displayName: string; email?: string; source?: string })

// ---- Board ----
rolloverBoard(fromDate: string, toDate: string, timezone?: string)

// ---- AI ----
checkAIStatus(): Promise<{ available: boolean }>
suggestTask(inputText: string, currentDate?: string)
draftMessage(data: DraftMessageInput)
```

---

## TypeScript Interfaces

Declare these in `src/client.ts`:

```typescript
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | null;
  dueAt: string | null;
  boardDate: string | null;
  sortOrder: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  accountablePersonId: string;
  executorPersonId: string | null;
  userId: string;
  project?: Project | null;
  accountablePerson?: Person;
  executorPerson?: Person | null;
  stakeholders?: Stakeholder[];
  followUps?: FollowUp[];
  contextNotes?: ContextNote[];
  activities?: TaskActivity[];
}

export interface Person {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  dueAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface FollowUp {
  id: string;
  taskId: string;
  followUpType: 'self_accountability' | 'executor_checkin' | 'stakeholder_update';
  targetPersonId: string | null;
  dueAt: string;
  status: 'pending' | 'completed' | 'snoozed';
  completedAt: string | null;
  snoozedUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  targetPerson?: Person | null;
}

export interface Stakeholder {
  id: string;
  taskId: string;
  personId: string;
  role: string | null;
  createdAt: string;
  person?: Person;
}

export interface ContextNote {
  id: string;
  content: string;
  noteType: 'general' | 'meeting' | 'link' | 'ai_generated';
  taskId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  activityType: string;
  description: string;
  metadata: unknown | null;
  note: string | null;
  createdAt: string;
}
```

---

## Taskline REST API Reference

All endpoints require `Authorization: Bearer tl_...`.

### Tasks

| Method | Path | Body / Query |
|--------|------|-------------|
| GET | `/api/tasks` | `?boardDate=YYYY-MM-DD&dueFrom=&dueTo=&projectId=` |
| POST | `/api/tasks` | `{ title, description?, dueAt?, projectId?, accountablePersonId?, executorPersonId?, stakeholderPersonIds[]?, boardDate?, priority?, timezone? }` |
| GET | `/api/tasks/:id` | — (includes `followUps[]`, `activities[]`, `contextNotes[]`, `stakeholders[]`) |
| PATCH | `/api/tasks/:id` | any subset of POST body + `status?` |
| DELETE | `/api/tasks/:id` | — |
| POST | `/api/tasks/:id/complete` | — |
| POST | `/api/tasks/:id/move` | `{ boardDate: "YYYY-MM-DD", timezone? }` |
| POST | `/api/tasks/:id/reorder` | `{ direction: "up" \| "down", targetDate?: "YYYY-MM-DD", timezone? }` |
| POST | `/api/tasks/:id/followups/generate` | `{ timezone? }` |

**Task status values:** `not_started` | `in_progress` | `waiting` | `completed` | `cancelled`
**Task priority values:** `low` | `medium` | `high`

### Follow-Ups

| Method | Path | Body |
|--------|------|------|
| POST | `/api/followups` | `{ taskId, followUpType, targetPersonId?, dueAt }` |
| POST | `/api/followups/generate` | `{ boardDate?: "YYYY-MM-DD", timezone? }` |
| GET | `/api/followups/:id` | — |
| POST | `/api/followups/:id/complete` | `{ notes? }` |
| POST | `/api/followups/:id/snooze` | `{ until: ISO_datetime }` |
| DELETE | `/api/followups/:id` | — |

**FollowUp type values:** `self_accountability` | `executor_checkin` | `stakeholder_update`
**FollowUp status values:** `pending` | `completed` | `snoozed`

> **No dedicated list endpoint for follow-ups.** `GET /api/tasks/:id` returns the full task with `followUps[]` embedded.

### Projects

| Method | Path | Body |
|--------|------|------|
| GET | `/api/projects` | — |
| POST | `/api/projects` | `{ name, description?, dueAt? }` |
| PATCH | `/api/projects/:id` | `{ name?, description?, isActive? }` |
| DELETE | `/api/projects/:id` | `{ moveToProjectId? }` |

### People

| Method | Path | Body / Query |
|--------|------|-------------|
| GET | `/api/people` | `?query=searchterm` (searches handle, displayName, email) |
| POST | `/api/people` | `{ handle, displayName, email?, source? }` |

### Board

| Method | Path | Body |
|--------|------|------|
| POST | `/api/board/rollover` | `{ fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD", timezone? }` |

> **No GET /api/board endpoint.** Use `GET /api/tasks?boardDate=YYYY-MM-DD`.

### API Keys

| Method | Path | Body |
|--------|------|------|
| GET | `/api/api-keys` | — lists keys (no raw values) |
| POST | `/api/api-keys` | `{ name }` — returns raw key once |
| DELETE | `/api/api-keys/:id` | — revokes key |

### AI (optional — check `GET /api/ai/status` first)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/ai/status` | — → `{ available: boolean }` |
| POST | `/api/ai/suggest-task` | `{ inputText, currentDate?: "YYYY-MM-DD" }` |
| POST | `/api/ai/draft-message` | `{ taskTitle, taskDescription?, projectName?, targetPersonName, targetPersonHandle, intent, channel, dueDate? }` |
| POST | `/api/ai/draft-email` | `{ taskTitle, taskDescription?, projectName?, accountablePersonName, executorPersonName?, stakeholderNames[], status, dueDate?, recentActivitySummary? }` |
| POST | `/api/ai/rewrite-draft` | `{ currentSubject, currentBody, instruction }` |

---

## Tool Registry Pattern

**File:** `src/tools/registry.ts`

The MCP SDK only allows one `ListToolsRequestSchema` and one `CallToolRequestSchema` handler per server. Since tools span multiple files, use a shared registry:

```typescript
import type { TasklineClient } from '../client.js';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (
    args: Record<string, unknown>,
    client: TasklineClient
  ) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;
}

export const toolRegistry: ToolDef[] = [];

export function registerTool(def: ToolDef): void {
  toolRegistry.push(def);
}
```

Each domain file calls `registerTool(...)` at module load time. `src/index.ts` imports all tool files to trigger registration, then handles both request schemas using `toolRegistry`.

---

## `src/index.ts` Structure

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TasklineClient } from './client.js';
import { toolRegistry } from './tools/registry.js';
import { resourceRegistry } from './resources.js';

// Side-effect imports to populate toolRegistry
import './tools/tasks.js';
import './tools/followups.js';
import './tools/projects.js';
import './tools/people.js';
import './tools/board.js';
import './tools/ai.js';

// Validate env vars — fail fast
const REQUIRED_ENV = ['TASKLINE_URL', 'TASKLINE_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

async function main() {
  const client = new TasklineClient({
    baseUrl: process.env.TASKLINE_URL!,
    apiKey: process.env.TASKLINE_API_KEY!,
  });

  // Verify the API key works before starting
  try {
    await client.listProjects();
  } catch (err) {
    console.error('Taskline API key verification failed:', err);
    process.exit(1);
  }

  const server = new Server(
    { name: 'taskline', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolRegistry.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolRegistry.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }
    try {
      return await tool.handler(
        (request.params.arguments ?? {}) as Record<string, unknown>,
        client
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceRegistry.map((r) => ({
      uri: r.uriPattern,
      name: r.name,
      description: r.description,
      mimeType: 'text/markdown',
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    for (const resource of resourceRegistry) {
      const match = resource.match(request.params.uri);
      if (match) {
        const text = await resource.read(match, client);
        return { contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text }] };
      }
    }
    throw new Error(`Resource not found: ${request.params.uri}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Taskline MCP server running'); // stderr only
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

---

## All 20 Tool Schemas

### Tasks (`src/tools/tasks.ts`) — 8 tools

**`list_tasks`**
```json
{
  "boardDate": { "type": "string", "description": "Filter by board date YYYY-MM-DD" },
  "dueFrom":   { "type": "string", "description": "Filter tasks due from this date YYYY-MM-DD" },
  "dueTo":     { "type": "string", "description": "Filter tasks due up to this date YYYY-MM-DD" },
  "projectId": { "type": "string", "description": "Filter by project UUID" }
}
required: []
```

**`get_task`**
```json
{ "id": { "type": "string", "description": "Task UUID" } }
required: ["id"]
```

**`create_task`**
```json
{
  "title":                { "type": "string", "description": "Task title (required)" },
  "description":          { "type": "string" },
  "dueAt":                { "type": "string", "description": "Due date ISO string or YYYY-MM-DD" },
  "projectId":            { "type": "string", "description": "Project UUID" },
  "accountablePersonId":  { "type": "string", "description": "Person UUID who is accountable" },
  "executorPersonId":     { "type": "string", "description": "Person UUID who does the work" },
  "stakeholderPersonIds": { "type": "array", "items": { "type": "string" } },
  "boardDate":            { "type": "string", "description": "Schedule on board YYYY-MM-DD" },
  "priority":             { "type": "string", "enum": ["low", "medium", "high"] },
  "timezone":             { "type": "string", "description": "IANA timezone e.g. America/Denver" }
}
required: ["title"]
```

**`update_task`**
```json
{
  "id":                   { "type": "string" },
  "title":                { "type": "string" },
  "description":          { "type": "string" },
  "status":               { "type": "string", "enum": ["not_started", "in_progress", "waiting", "completed", "cancelled"] },
  "priority":             { "type": "string", "enum": ["low", "medium", "high"] },
  "dueAt":                { "type": "string" },
  "boardDate":            { "type": "string" },
  "projectId":            { "type": "string" },
  "accountablePersonId":  { "type": "string" },
  "executorPersonId":     { "type": "string" },
  "timezone":             { "type": "string" }
}
required: ["id"]
```

**`delete_task`** — `required: ["id"]`

**`complete_task`** — `required: ["id"]`

**`move_task`**
```json
{
  "id":        { "type": "string" },
  "boardDate": { "type": "string", "description": "Target date YYYY-MM-DD" },
  "timezone":  { "type": "string" }
}
required: ["id", "boardDate"]
```

**`reorder_task`**
```json
{
  "id":         { "type": "string" },
  "direction":  { "type": "string", "enum": ["up", "down"] },
  "targetDate": { "type": "string", "description": "Board date YYYY-MM-DD if task lacks one" },
  "timezone":   { "type": "string" }
}
required: ["id", "direction"]
```

---

### Follow-Ups (`src/tools/followups.ts`) — 5 tools

**`list_followups_for_task`**
> Implementation: calls `client.getTask(taskId)` and returns `task.followUps`

```json
{ "taskId": { "type": "string" } }
required: ["taskId"]
```

**`complete_followup`**
```json
{
  "id":    { "type": "string" },
  "notes": { "type": "string", "description": "Optional completion notes" }
}
required: ["id"]
```

**`snooze_followup`**
```json
{
  "id":    { "type": "string" },
  "until": { "type": "string", "description": "ISO datetime e.g. 2026-04-01T09:00:00" }
}
required: ["id", "until"]
```

**`generate_followups`**
```json
{
  "boardDate": { "type": "string", "description": "YYYY-MM-DD, defaults to today" },
  "timezone":  { "type": "string" }
}
required: []
```

**`delete_followup`** — `required: ["id"]`

---

### Projects (`src/tools/projects.ts`) — 4 tools

**`list_projects`** — no parameters

**`create_project`**
```json
{
  "name":        { "type": "string" },
  "description": { "type": "string" },
  "dueAt":       { "type": "string" }
}
required: ["name"]
```

**`update_project`**
```json
{
  "id":          { "type": "string" },
  "name":        { "type": "string" },
  "description": { "type": "string" },
  "isActive":    { "type": "boolean" }
}
required: ["id"]
```

**`delete_project`**
```json
{
  "id":              { "type": "string" },
  "moveToProjectId": { "type": "string", "description": "UUID to reassign tasks to, or omit to unassign" }
}
required: ["id"]
```

---

### People (`src/tools/people.ts`) — 2 tools

**`list_people`**
```json
{ "query": { "type": "string", "description": "Search by handle, displayName, or email" } }
required: []
```

**`create_person`**
```json
{
  "handle":      { "type": "string", "description": "Unique short handle e.g. brett" },
  "displayName": { "type": "string" },
  "email":       { "type": "string" },
  "source":      { "type": "string", "description": "Defaults to manual" }
}
required: ["handle", "displayName"]
```

---

### Board (`src/tools/board.ts`) — 2 tools

**`get_board`**
> Implementation: calls `client.listTasks({ boardDate: date })`, returns formatted Markdown.
```json
{
  "date":     { "type": "string", "description": "Board date YYYY-MM-DD" },
  "timezone": { "type": "string" }
}
required: ["date"]
```

**`rollover_board`**
```json
{
  "fromDate": { "type": "string", "description": "YYYY-MM-DD source date" },
  "toDate":   { "type": "string", "description": "YYYY-MM-DD target date" },
  "timezone": { "type": "string" }
}
required: ["fromDate", "toDate"]
```

---

### AI (`src/tools/ai.ts`) — 2 tools

Check `client.checkAIStatus()` before registering. If unavailable, log to stderr and skip.

**`suggest_task_from_text`**
```json
{
  "inputText":   { "type": "string", "description": "Natural language task description" },
  "currentDate": { "type": "string", "description": "YYYY-MM-DD, defaults to today" }
}
required: ["inputText"]
```

**`draft_followup_message`**
> Implementation: call `client.listPeople(targetPersonHandle)` to resolve handle → person, then call `client.draftMessage(...)`.
```json
{
  "taskId":             { "type": "string" },
  "targetPersonHandle": { "type": "string", "description": "Handle of person to message e.g. steen" },
  "intent":             { "type": "string", "description": "Purpose e.g. check on status, remind of deadline" },
  "channel":            { "type": "string", "enum": ["email", "slack", "teams", "text"] }
}
required: ["taskId", "targetPersonHandle", "intent", "channel"]
```

---

## Resources (`src/resources.ts`)

Define a `resourceRegistry` array. Each entry has `uriPattern`, `name`, `description`, `match(uri)`, and `read(params, client)`.

| Resource URI | Data Source | Format |
|---|---|---|
| `taskline://board/{date}` | `listTasks({ boardDate: date })` | Markdown task list by priority |
| `taskline://projects` | `listProjects()` | Markdown list with status |
| `taskline://people` | `listPeople()` | Markdown table: handle + displayName |
| `taskline://tasks/{id}` | `getTask(id)` | Full detail: follow-ups, activities, stakeholders |

Format resources as human-readable Markdown. Example `taskline://board/2026-03-29`:
```markdown
# Board — 2026-03-29

## [HIGH] Finalize Q1 report
- Status: in_progress
- Due: 2026-03-31
- Accountable: Brett
- Project: Finance
- Follow-ups: 2 pending
```

---

## Tool Handler Response Pattern

```typescript
// Success
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
};

// Error
return {
  content: [{ type: 'text', text: `Error: ${message}` }],
  isError: true,
};
```

Wrap every handler body in try/catch.

---

## Stdio Transport Rules

- All diagnostic output **must** go to `stderr` via `console.error()`
- `stdout` is the MCP protocol channel — any `console.log()` corrupts the protocol

---

## Claude Code `.mcp.json` Configuration

Place at the **Taskline repo root** as `.mcp.json` (add to `.gitignore`):

```json
{
  "mcpServers": {
    "taskline": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "TASKLINE_URL": "http://localhost:5173",
        "TASKLINE_API_KEY": "tl_your_api_key_here"
      }
    }
  }
}
```

Also create `.mcp.json.example` (committed) with placeholder values.

For **Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "taskline": {
      "command": "node",
      "args": ["/Users/brett/Documents/Code/CheLabs/Taskline/mcp-server/dist/index.js"],
      "env": {
        "TASKLINE_URL": "https://your-app.vercel.app",
        "TASKLINE_API_KEY": "tl_your_api_key_here"
      }
    }
  }
}
```

---

## Build & Run

```bash
cd mcp-server
npm install
npm run build
npm start
```

---

## Testing

```bash
cd mcp-server
npm run build
TASKLINE_URL=http://localhost:5173 \
TASKLINE_API_KEY=tl_... \
npx @modelcontextprotocol/inspector node dist/index.js
```

**Verify these scenarios:**
1. `list_projects` returns the user's projects
2. `create_task` with just a `title` succeeds
3. `complete_task` marks a task done and returns updated task
4. `list_followups_for_task` returns follow-ups extracted from task detail
5. `get_board` for today returns scheduled tasks
6. Resource `taskline://board/2026-03-29` returns Markdown

---

## Known Gotchas

1. **ESM imports need `.js` extension** — write `import { foo } from './client.js'` even when source is `.ts`
2. **`console.log` breaks MCP** — use `console.error()` for all diagnostic output
3. **`list_followups_for_task` has no dedicated endpoint** — extract from `getTask(id).followUps`
4. **`get_board` has no dedicated endpoint** — use `listTasks({ boardDate })`
5. **`draft_followup_message` needs handle→ID resolution** — call `listPeople(handle)` first
6. **Zod v3 not v4** — `@modelcontextprotocol/sdk` tooling is built around Zod v3
7. **AI tools are optional** — call `checkAIStatus()` before registering; log and skip if unavailable
8. **One `setRequestHandler` per schema type** — multiple calls overwrite each other; use the registry pattern
9. **`@modelcontextprotocol/sdk` version** — pin to `^1.0.0`; the API changed significantly between 0.x and 1.x
10. **Taskline app must be updated first** — the `ApiKey` model and `hooks.server.ts` changes in Part 1 must be deployed before the MCP server will work. Without them, all requests will get a 303 redirect to `/auth/login` instead of a 401.
11. **API route 401 vs redirect** — the `hooks.server.ts` change must return a JSON 401 response (not a redirect) for API routes with invalid/missing auth, otherwise the MCP client sees HTML instead of an error message.
