# Taskline API v1

Base URL: `http://localhost:5173/api/v1`

## Authentication

All requests require the `X-API-Key` header. Each key is tied to a specific Taskline user — all operations execute in that user's context.

```
X-API-Key: <your-api-key>
```

Requests without a valid key receive `401 Unauthorized`.

**Managing keys:**
- **In the app:** Navigate to `/settings` to generate, view, and revoke API keys
- **Via API:** Use the `/api/v1/api-keys` endpoints below (requires an existing key)
- **Seed data:** Run `npx prisma db seed` to generate a default key for local development

---

## API Keys

### List API Keys

```
GET /api/v1/api-keys
```

Returns the current user's API keys with masked key values.

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "n8n integration",
      "keyPrefix": "a1b2c3d4...ef56",
      "createdAt": "2026-02-16T00:00:00.000Z",
      "lastUsedAt": "2026-02-16T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### Create API Key

```
POST /api/v1/api-keys
Content-Type: application/json
```

**Body:**

| Field  | Type   | Required | Default     | Description            |
| ------ | ------ | -------- | ----------- | ---------------------- |
| `name` | string | No       | `"Default"` | Human-readable label   |

**Response:** `201 Created` — the full key is returned **only at creation time**.

```json
{
  "id": "uuid",
  "name": "n8n integration",
  "key": "full-64-char-hex-key-shown-only-once",
  "createdAt": "2026-02-16T00:00:00.000Z"
}
```

---

### Revoke API Key

```
DELETE /api/v1/api-keys/:id
```

**Response:**

```json
{ "success": true }
```

**Errors:**

| Status | Meaning           |
| ------ | ----------------- |
| 404    | API key not found |

---

## Tasks

### List Tasks

```
GET /api/v1/tasks
```

**Query Parameters:**

| Param       | Type   | Default | Description                                                        |
| ----------- | ------ | ------- | ------------------------------------------------------------------ |
| `status`    | string | —       | Filter by status: `not_started`, `in_progress`, `waiting`, `completed`, `cancelled` |
| `projectId` | string | —       | Filter by project UUID                                             |
| `limit`     | number | 100     | Page size (max 500)                                                |
| `offset`    | number | 0       | Number of records to skip                                          |

**Response:**

```json
{
  "data": [ /* array of Task objects */ ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

---

### Get Task

```
GET /api/v1/tasks/:id
```

Returns a single task with all relations (project, people, follow-ups, context notes).

**Response:** A single Task object (see [Task Object](#task-object) below).

**Errors:**

| Status | Meaning        |
| ------ | -------------- |
| 404    | Task not found |

---

### Create Task

```
POST /api/v1/tasks
Content-Type: application/json
```

**Body:**

| Field                  | Type   | Required | Default         | Description                                      |
| ---------------------- | ------ | -------- | --------------- | ------------------------------------------------ |
| `title`                | string | Yes      | —               | Task title                                       |
| `description`          | string | No       | `null`          | Task description                                 |
| `status`               | string | No       | `"not_started"` | One of: `not_started`, `in_progress`, `waiting`, `completed`, `cancelled` |
| `priority`             | string | No       | `null`          | Free-text priority                               |
| `dueAt`                | string | No       | `null`          | ISO 8601 datetime or `YYYY-MM-DD` date string    |
| `boardDate`            | string | No       | `null`          | ISO 8601 datetime or `YYYY-MM-DD` date string    |
| `projectId`            | string | No       | `null`          | UUID of an existing project                      |
| `accountablePersonId`  | string | No       | user's "me"     | UUID of the accountable person (auto-resolved)   |
| `executorPersonId`     | string | No       | accountable     | UUID of the executor (defaults to accountable)   |
| `timezone`             | string | No       | `America/Denver`| IANA timezone for date-only string parsing        |

**Response:** `201 Created` with the created Task object.

**Example:**

```bash
curl -X POST http://localhost:5173/api/v1/tasks \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Review Q1 report",
    "dueAt": "2026-02-20",
    "priority": "high"
  }'
```

---

### Update Task

```
PATCH /api/v1/tasks/:id
Content-Type: application/json
```

Send any subset of task fields to update. Date fields (`dueAt`, `boardDate`, `completedAt`) accept ISO 8601 strings.

**Example:**

```bash
curl -X PATCH http://localhost:5173/api/v1/tasks/TASK_UUID \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "in_progress" }'
```

**Response:** The updated Task object.

**Errors:**

| Status | Meaning        |
| ------ | -------------- |
| 404    | Task not found |

---

### Delete Task

```
DELETE /api/v1/tasks/:id
```

**Response:**

```json
{ "success": true }
```

**Errors:**

| Status | Meaning        |
| ------ | -------------- |
| 404    | Task not found |

---

## People

### List People

```
GET /api/v1/people
```

**Query Parameters:**

| Param   | Type   | Default | Description                                           |
| ------- | ------ | ------- | ----------------------------------------------------- |
| `query` | string | —       | Search across handle, displayName, and email (case-insensitive) |

**Response:**

```json
{
  "data": [ /* array of Person objects */ ],
  "total": 5
}
```

---

### Get Person

```
GET /api/v1/people/:id
```

Returns a person with their accountable and executor task assignments.

**Response:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "handle": "steen",
  "displayName": "Steen",
  "email": "steen@example.com",
  "source": "manual",
  "createdAt": "2026-02-16T00:00:00.000Z",
  "updatedAt": "2026-02-16T00:00:00.000Z",
  "accountableTasks": [
    { "id": "uuid", "title": "Task title", "status": "in_progress" }
  ],
  "executorTasks": [
    { "id": "uuid", "title": "Task title", "status": "not_started" }
  ]
}
```

**Errors:**

| Status | Meaning          |
| ------ | ---------------- |
| 404    | Person not found |

---

### Create Person

```
POST /api/v1/people
Content-Type: application/json
```

**Body:**

| Field         | Type   | Required | Default    | Description                     |
| ------------- | ------ | -------- | ---------- | ------------------------------- |
| `handle`      | string | Yes      | —          | Unique short name (e.g. "steen") |
| `displayName` | string | Yes      | —          | Full display name               |
| `email`       | string | No       | `null`     | Email address                   |
| `source`      | string | No       | `"manual"` | Origin: `manual` or `import`    |

**Response:** `201 Created` with the created Person object.

**Example:**

```bash
curl -X POST http://localhost:5173/api/v1/people \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "steen",
    "displayName": "Steen Larsen",
    "email": "steen@example.com"
  }'
```

---

### Update Person

```
PATCH /api/v1/people/:id
Content-Type: application/json
```

Send any subset of `handle`, `displayName`, `email`.

**Response:** The updated Person object.

**Errors:**

| Status | Meaning          |
| ------ | ---------------- |
| 404    | Person not found |

---

### Delete Person

```
DELETE /api/v1/people/:id
```

**Response:**

```json
{ "success": true }
```

**Errors:**

| Status | Meaning                              |
| ------ | ------------------------------------ |
| 400    | Cannot delete the "me" person        |
| 404    | Person not found                     |

---

## Projects

### List Projects

```
GET /api/v1/projects
```

**Query Parameters:**

| Param    | Type   | Default | Description                                     |
| -------- | ------ | ------- | ----------------------------------------------- |
| `active` | string | —       | Filter by active status: `true` or `false`      |
| `limit`  | number | 50      | Page size (max 200)                              |
| `offset` | number | 0       | Number of records to skip                        |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Optional description",
      "isActive": true,
      "dueAt": "2026-03-01T00:00:00.000Z",
      "createdAt": "2026-01-15T00:00:00.000Z",
      "updatedAt": "2026-01-15T00:00:00.000Z",
      "_count": { "tasks": 14 }
    }
  ],
  "total": 3,
  "limit": 50,
  "offset": 0
}
```

---

### Get Project

```
GET /api/v1/projects/:id
```

Returns a single project with its tasks and task counts by status.

**Response:**

```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "...",
  "isActive": true,
  "dueAt": null,
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-01-15T00:00:00.000Z",
  "tasks": [
    { "id": "uuid", "title": "Task title", "status": "in_progress", "priority": "high", "dueAt": null, "createdAt": "..." }
  ],
  "taskCounts": {
    "not_started": 3,
    "in_progress": 1,
    "waiting": 0,
    "completed": 10,
    "cancelled": 0,
    "total": 14
  }
}
```

**Errors:**

| Status | Meaning            |
| ------ | ------------------ |
| 404    | Project not found  |

---

### Create Project

```
POST /api/v1/projects
Content-Type: application/json
```

**Body:**

| Field         | Type    | Required | Default | Description                |
| ------------- | ------- | -------- | ------- | -------------------------- |
| `name`        | string  | Yes      | —       | Project name               |
| `description` | string  | No       | `null`  | Project description        |
| `dueAt`       | string  | No       | `null`  | ISO 8601 date string       |
| `isActive`    | boolean | No       | `true`  | Whether project is active  |

**Response:** `201 Created` with the created Project object.

**Example:**

```bash
curl -X POST http://localhost:5173/api/v1/projects \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q1 Launch",
    "description": "Everything related to the Q1 product launch"
  }'
```

---

### Update Project

```
PATCH /api/v1/projects/:id
Content-Type: application/json
```

Send any subset of `name`, `description`, `dueAt`, `isActive`.

When `isActive` is set to `false`, all pending follow-ups on the project's tasks are automatically marked as completed.

**Response:** The updated Project object.

**Errors:**

| Status | Meaning            |
| ------ | ------------------ |
| 404    | Project not found  |

---

### Delete Project

```
DELETE /api/v1/projects/:id
Content-Type: application/json
```

**Body (optional):**

| Field              | Type   | Required | Default | Description                                      |
| ------------------ | ------ | -------- | ------- | ------------------------------------------------ |
| `moveToProjectId`  | string | No       | `null`  | UUID of project to reassign tasks to (null = unassign) |

**Response:**

```json
{ "success": true, "tasksReassigned": 5 }
```

**Errors:**

| Status | Meaning            |
| ------ | ------------------ |
| 404    | Project not found  |

---

### Move Task to Project

Use the existing task update endpoint to move a task between projects:

```bash
curl -X PATCH http://localhost:5173/api/v1/tasks/TASK_UUID \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "projectId": "PROJECT_UUID" }'
```

Set `projectId` to `null` to unassign a task from its project.

---

## Reports

### Summary

```
GET /api/v1/reports/summary
```

Returns task counts grouped by status.

**Response:**

```json
{
  "not_started": 12,
  "in_progress": 4,
  "waiting": 2,
  "completed": 55,
  "cancelled": 1,
  "total": 74
}
```

---

### By Project

```
GET /api/v1/reports/by-project
```

Returns each project with task counts per status, plus an "unassigned" bucket for tasks with no project.

**Response:**

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "...",
      "isActive": true,
      "createdAt": "2026-01-15T00:00:00.000Z",
      "updatedAt": "2026-01-15T00:00:00.000Z",
      "taskCounts": {
        "not_started": 3,
        "in_progress": 1,
        "waiting": 0,
        "completed": 10,
        "cancelled": 0,
        "total": 14
      }
    }
  ],
  "unassigned": {
    "id": null,
    "name": "Unassigned",
    "taskCounts": { "not_started": 2, "in_progress": 0, "waiting": 1, "completed": 5, "cancelled": 0, "total": 8 }
  }
}
```

---

### Overdue

```
GET /api/v1/reports/overdue
```

Returns tasks where `dueAt` is in the past and status is not `completed` or `cancelled`.

**Response:**

```json
{
  "data": [ /* array of Task objects with project, accountablePerson, executorPerson */ ],
  "total": 3
}
```

---

### Completed Over Time

```
GET /api/v1/reports/completed
```

**Query Parameters:**

| Param    | Type   | Default | Description                        |
| -------- | ------ | ------- | ---------------------------------- |
| `groupBy`| string | `day`   | One of: `day`, `week`, `month`     |

Returns tasks completed within the lookback window, grouped by period.

| groupBy | Lookback   | Period key format |
| ------- | ---------- | ----------------- |
| `day`   | 30 days    | `YYYY-MM-DD`      |
| `week`  | 12 weeks   | `YYYY-MM-DD` (Monday of week) |
| `month` | 12 months  | `YYYY-MM`         |

**Response:**

```json
{
  "groupBy": "day",
  "total": 18,
  "periods": [
    { "period": "2026-02-10", "count": 3, "taskIds": ["uuid1", "uuid2", "uuid3"] },
    { "period": "2026-02-11", "count": 1, "taskIds": ["uuid4"] }
  ]
}
```

---

## Task Object

Full task object returned by CRUD endpoints:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "title": "Task title",
  "description": "Optional description",
  "status": "not_started",
  "priority": "high",
  "dueAt": "2026-02-20T07:00:00.000Z",
  "boardDate": "2026-02-20T00:00:00.000Z",
  "sortOrder": null,
  "completedAt": null,
  "createdAt": "2026-02-16T00:00:00.000Z",
  "updatedAt": "2026-02-16T00:00:00.000Z",
  "projectId": "uuid",
  "accountablePersonId": "uuid",
  "executorPersonId": "uuid",
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "description": "...",
    "isActive": true
  },
  "accountablePerson": {
    "id": "uuid",
    "handle": "me",
    "displayName": "Brett",
    "email": "brett@example.com"
  },
  "executorPerson": {
    "id": "uuid",
    "handle": "me",
    "displayName": "Brett",
    "email": "brett@example.com"
  },
  "stakeholders": [],
  "followUps": [],
  "contextNotes": []
}
```

**Notes:**
- `followUps` and `contextNotes` are only included on `GET /api/v1/tasks/:id` (single task).
- List endpoints include `project`, `accountablePerson`, `executorPerson`, and `stakeholders`.

---

## Error Responses

All errors return JSON:

```json
{ "error": "Error message" }
```

| Status | Meaning                          |
| ------ | -------------------------------- |
| 400    | Bad request (missing/invalid fields) |
| 401    | Missing or invalid API key       |
| 404    | Resource not found               |
| 422    | Validation error (e.g. no "me" person) |
