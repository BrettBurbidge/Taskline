import { describe, it, expect, beforeAll } from "vitest";
import { api, skipIfNoKey } from "./setup";

describe("API Key Authentication", () => {
  beforeAll(() => {
    if (skipIfNoKey() === "skip") return;
  });

  it("returns 401 without X-API-Key header", async () => {
    const res = await api("/api/v1/tasks", { key: null });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid API key", async () => {
    const res = await api("/api/v1/tasks", { key: "bad-key-that-does-not-exist" });
    expect(res.status).toBe(401);
  });

  it("returns 200 with valid API key", async () => {
    const res = await api("/api/v1/tasks");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
  });
});
