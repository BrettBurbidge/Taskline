import { describe, it, expect } from "vitest";
import { api, apiJson, shouldSkip } from "./setup";

describe.skipIf(shouldSkip)("API Keys Management", () => {
  let createdKeyId: string;
  let createdKeyValue: string;

  it("POST /api/v1/api-keys — creates a new key", async () => {
    const { status, data } = await apiJson<any>("/api/v1/api-keys", {
      method: "POST",
      body: { name: "Test Key" },
    });

    expect(status).toBe(201);
    expect(data.name).toBe("Test Key");
    expect(data.key).toBeDefined();
    expect(data.key.length).toBe(64); // 32 bytes hex = 64 chars

    createdKeyId = data.id;
    createdKeyValue = data.key;
  });

  it("GET /api/v1/api-keys — lists keys with masked values", async () => {
    const { status, data } = await apiJson<any>("/api/v1/api-keys");

    expect(status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);

    const testKey = data.data.find((k: any) => k.id === createdKeyId);
    expect(testKey).toBeDefined();
    expect(testKey.keyPrefix).toContain("...");
    // Should NOT expose the full key
    expect(testKey.key).toBeUndefined();
  });

  it("newly created key works for authentication", async () => {
    const res = await api("/api/v1/tasks", { key: createdKeyValue });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/v1/api-keys/:id — revokes the key", async () => {
    const { status, data } = await apiJson<any>(`/api/v1/api-keys/${createdKeyId}`, {
      method: "DELETE",
    });

    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("revoked key no longer works", async () => {
    const res = await api("/api/v1/tasks", { key: createdKeyValue });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/v1/api-keys/:id — 404 for nonexistent key", async () => {
    const res = await api("/api/v1/api-keys/00000000-0000-0000-0000-ffffffffffff", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
