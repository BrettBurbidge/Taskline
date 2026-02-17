import { describe, it, expect } from "vitest";
import { api, apiJson, shouldSkip } from "./setup";

describe.skipIf(shouldSkip)("Projects CRUD", () => {
  let projectId: string;
  let taskId: string;

  it("POST /api/v1/projects — creates a project", async () => {
    const { status, data } = await apiJson<any>("/api/v1/projects", {
      method: "POST",
      body: {
        name: "Integration Test Project",
        description: "Created by test suite",
      },
    });

    expect(status).toBe(201);
    expect(data.name).toBe("Integration Test Project");
    expect(data.description).toBe("Created by test suite");
    expect(data.isActive).toBe(true);
    expect(data.id).toBeDefined();

    projectId = data.id;
  });

  it("POST /api/v1/projects — rejects missing name", async () => {
    const res = await api("/api/v1/projects", {
      method: "POST",
      body: { description: "no name" },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/projects — lists projects", async () => {
    const { status, data } = await apiJson<any>("/api/v1/projects");

    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data).toHaveProperty("limit");
    expect(data).toHaveProperty("offset");
  });

  it("GET /api/v1/projects — filters by active", async () => {
    const { status, data } = await apiJson<any>("/api/v1/projects?active=true");

    expect(status).toBe(200);
    for (const project of data.data) {
      expect(project.isActive).toBe(true);
    }
  });

  it("GET /api/v1/projects/:id — returns the project with tasks", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/projects/${projectId}`);

    expect(status).toBe(200);
    expect(data.id).toBe(projectId);
    expect(data.name).toBe("Integration Test Project");
    expect(data).toHaveProperty("tasks");
    expect(data).toHaveProperty("taskCounts");
    expect(data.taskCounts).toHaveProperty("total");
  });

  it("GET /api/v1/projects/:id — 404 for nonexistent project", async () => {
    const res = await api("/api/v1/projects/00000000-0000-0000-0000-ffffffffffff");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/v1/projects/:id — updates the project", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      body: { name: "Updated Project Name", description: "Updated desc" },
    });

    expect(status).toBe(200);
    expect(data.name).toBe("Updated Project Name");
    expect(data.description).toBe("Updated desc");
  });

  it("PATCH /api/v1/projects/:id — 404 for nonexistent project", async () => {
    const res = await api("/api/v1/projects/00000000-0000-0000-0000-ffffffffffff", {
      method: "PATCH",
      body: { name: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("Move task to project via PATCH /api/v1/tasks/:id", async () => {
    // Create a task
    const { data: task } = await apiJson<any>("/api/v1/tasks", {
      method: "POST",
      body: { title: "Task for project test" },
    });
    taskId = task.id;

    // Move it to the project
    const { status, data } = await apiJson<any>(`/api/v1/tasks/${taskId}`, {
      method: "PATCH",
      body: { projectId },
    });

    expect(status).toBe(200);
    expect(data.projectId).toBe(projectId);
  });

  it("GET /api/v1/projects/:id — shows assigned task", async () => {
    const { data } = await apiJson<any>(`/api/v1/projects/${projectId}`);

    expect(data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(data.tasks.some((t: any) => t.id === taskId)).toBe(true);
    expect(data.taskCounts.total).toBeGreaterThanOrEqual(1);
  });

  it("DELETE /api/v1/projects/:id — deletes and unassigns tasks", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/projects/${projectId}`, {
      method: "DELETE",
    });

    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tasksReassigned).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/v1/projects/:id — 404 after deletion", async () => {
    const res = await api(`/api/v1/projects/${projectId}`);
    expect(res.status).toBe(404);
  });

  it("Task is unassigned after project deletion", async () => {
    const { data } = await apiJson<any>(`/api/v1/tasks/${taskId}`);
    expect(data.projectId).toBeNull();

    // Clean up
    await api(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
  });
});
