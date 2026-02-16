import { describe, it, expect, beforeAll } from "vitest";
import { api, apiJson, skipIfNoKey } from "./setup";

describe("Tasks CRUD", () => {
  let taskId: string;

  beforeAll(() => {
    if (skipIfNoKey() === "skip") return;
  });

  it("POST /api/v1/tasks — creates a task", async () => {
    const { status, data } = await apiJson<any>("/api/v1/tasks", {
      method: "POST",
      body: {
        title: "Integration Test Task",
        description: "Created by test suite",
        priority: "high",
      },
    });

    expect(status).toBe(201);
    expect(data.title).toBe("Integration Test Task");
    expect(data.description).toBe("Created by test suite");
    expect(data.priority).toBe("high");
    expect(data.status).toBe("not_started");
    expect(data.id).toBeDefined();
    expect(data.accountablePerson).toBeDefined();

    taskId = data.id;
  });

  it("POST /api/v1/tasks — rejects missing title", async () => {
    const res = await api("/api/v1/tasks", {
      method: "POST",
      body: { description: "no title" },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/tasks — lists tasks", async () => {
    const { status, data } = await apiJson<any>("/api/v1/tasks");

    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty("limit");
    expect(data).toHaveProperty("offset");
  });

  it("GET /api/v1/tasks — filters by status", async () => {
    const { status, data } = await apiJson<any>("/api/v1/tasks?status=not_started");

    expect(status).toBe(200);
    for (const task of data.data) {
      expect(task.status).toBe("not_started");
    }
  });

  it("GET /api/v1/tasks — respects limit and offset", async () => {
    const { status, data } = await apiJson<any>("/api/v1/tasks?limit=1&offset=0");

    expect(status).toBe(200);
    expect(data.data.length).toBeLessThanOrEqual(1);
    expect(data.limit).toBe(1);
    expect(data.offset).toBe(0);
  });

  it("GET /api/v1/tasks/:id — returns the created task", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/tasks/${taskId}`);

    expect(status).toBe(200);
    expect(data.id).toBe(taskId);
    expect(data.title).toBe("Integration Test Task");
    expect(data).toHaveProperty("followUps");
    expect(data).toHaveProperty("contextNotes");
  });

  it("GET /api/v1/tasks/:id — 404 for nonexistent task", async () => {
    const res = await api("/api/v1/tasks/00000000-0000-0000-0000-ffffffffffff");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/v1/tasks/:id — updates the task", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: { status: "in_progress", priority: "low" },
    });

    expect(status).toBe(200);
    expect(data.status).toBe("in_progress");
    expect(data.priority).toBe("low");
  });

  it("PATCH /api/v1/tasks/:id — 404 for nonexistent task", async () => {
    const res = await api("/api/v1/tasks/00000000-0000-0000-0000-ffffffffffff", {
      method: "PATCH",
      body: { title: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/v1/tasks/:id — deletes the task", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/tasks/${taskId}`, {
      method: "DELETE",
    });

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("GET /api/v1/tasks/:id — 404 after deletion", async () => {
    const res = await api(`/api/v1/tasks/${taskId}`);
    expect(res.status).toBe(404);
  });
});
