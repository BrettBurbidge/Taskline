import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, apiJson, shouldSkip } from "./setup";

describe.skipIf(shouldSkip)("Reports", () => {
  let taskId: string;

  beforeAll(async () => {
    // Create a test task so reports have data
    const { data } = await apiJson<any>("/api/v1/tasks", {
      method: "POST",
      body: {
        title: "Report Test Task",
        priority: "medium",
        dueAt: "2020-01-01", // in the past so it shows as overdue
      },
    });
    taskId = data.id;
  });

  afterAll(async () => {
    // Clean up
    if (taskId) {
      await api(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
    }
  });

  describe("GET /api/v1/reports/summary", () => {
    it("returns counts by status", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/summary");

      expect(status).toBe(200);
      expect(data).toHaveProperty("not_started");
      expect(data).toHaveProperty("in_progress");
      expect(data).toHaveProperty("waiting");
      expect(data).toHaveProperty("completed");
      expect(data).toHaveProperty("cancelled");
      expect(data).toHaveProperty("total");
      expect(typeof data.total).toBe("number");
      expect(data.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/v1/reports/by-project", () => {
    it("returns projects with task counts", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/by-project");

      expect(status).toBe(200);
      expect(Array.isArray(data.projects)).toBe(true);
      expect(data.unassigned).toBeDefined();
      expect(data.unassigned.taskCounts).toHaveProperty("total");
    });
  });

  describe("GET /api/v1/reports/overdue", () => {
    it("returns overdue tasks", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/overdue");

      expect(status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data).toHaveProperty("total");
      // Our test task with dueAt=2020-01-01 should be overdue
      expect(data.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/v1/reports/completed", () => {
    it("returns completed tasks grouped by day", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/completed");

      expect(status).toBe(200);
      expect(data.groupBy).toBe("day");
      expect(typeof data.total).toBe("number");
      expect(Array.isArray(data.periods)).toBe(true);
    });

    it("accepts groupBy=week", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/completed?groupBy=week");

      expect(status).toBe(200);
      expect(data.groupBy).toBe("week");
    });

    it("accepts groupBy=month", async () => {
      const { status, data } = await apiJson<any>("/api/v1/reports/completed?groupBy=month");

      expect(status).toBe(200);
      expect(data.groupBy).toBe("month");
    });

    it("rejects invalid groupBy", async () => {
      const res = await api("/api/v1/reports/completed?groupBy=invalid");
      expect(res.status).toBe(400);
    });
  });
});
