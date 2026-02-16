import { describe, it, expect, beforeAll } from "vitest";
import { api, apiJson, skipIfNoKey } from "./setup";

describe("People CRUD", () => {
  let personId: string;

  beforeAll(() => {
    if (skipIfNoKey() === "skip") return;
  });

  it("POST /api/v1/people — creates a person", async () => {
    const { status, data } = await apiJson<any>("/api/v1/people", {
      method: "POST",
      body: {
        handle: "testperson",
        displayName: "Test Person",
        email: "test@example.com",
      },
    });

    expect(status).toBe(201);
    expect(data.handle).toBe("testperson");
    expect(data.displayName).toBe("Test Person");
    expect(data.email).toBe("test@example.com");
    expect(data.source).toBe("manual");

    personId = data.id;
  });

  it("POST /api/v1/people — rejects missing handle", async () => {
    const res = await api("/api/v1/people", {
      method: "POST",
      body: { displayName: "No Handle" },
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/people — rejects missing displayName", async () => {
    const res = await api("/api/v1/people", {
      method: "POST",
      body: { handle: "noname" },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/people — lists people", async () => {
    const { status, data } = await apiJson<any>("/api/v1/people");

    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/v1/people — search by query", async () => {
    const { status, data } = await apiJson<any>("/api/v1/people?query=testperson");

    expect(status).toBe(200);
    expect(data.data.some((p: any) => p.handle === "testperson")).toBe(true);
  });

  it("GET /api/v1/people/:id — returns the person with tasks", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/people/${personId}`);

    expect(status).toBe(200);
    expect(data.id).toBe(personId);
    expect(data).toHaveProperty("accountableTasks");
    expect(data).toHaveProperty("executorTasks");
  });

  it("PATCH /api/v1/people/:id — updates the person", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/people/${personId}`, {
      method: "PATCH",
      body: { displayName: "Updated Name" },
    });

    expect(status).toBe(200);
    expect(data.displayName).toBe("Updated Name");
  });

  it("DELETE /api/v1/people/:id — deletes the person", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/people/${personId}`, {
      method: "DELETE",
    });

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("GET /api/v1/people/:id — 404 after deletion", async () => {
    const res = await api(`/api/v1/people/${personId}`);
    expect(res.status).toBe(404);
  });
});
