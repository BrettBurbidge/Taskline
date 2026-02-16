/**
 * Shared setup for integration tests.
 *
 * Requires:
 *   - The app running locally (npm run dev)
 *   - TEST_API_KEY env var set to a valid API key
 *
 * Usage in test files:
 *   import { api, API_KEY, skipIfNoKey } from './setup';
 *   beforeAll(() => skipIfNoKey());
 */

export const API_URL = process.env.API_URL ?? "http://localhost:5173";
export const API_KEY = process.env.TEST_API_KEY ?? "";

/**
 * Call in beforeAll() to skip the entire suite when no API key is available.
 */
export function skipIfNoKey() {
  if (!API_KEY) {
    console.warn("TEST_API_KEY not set — skipping integration tests");
    return "skip";
  }
  return "run";
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  key?: string | null; // override the API key (null = omit header)
}

/**
 * Fetch wrapper that prepends the base URL and sets the X-API-Key header.
 */
export async function api(path: string, options: ApiOptions = {}) {
  const { body, key, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };

  // key === null means intentionally omit the header
  if (key !== null) {
    headers["X-API-Key"] = key ?? API_KEY;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

/**
 * Convenience: fetch + parse JSON.
 */
export async function apiJson<T = unknown>(path: string, options: ApiOptions = {}): Promise<{ status: number; data: T }> {
  const res = await api(path, options);
  const data = await res.json();
  return { status: res.status, data: data as T };
}
