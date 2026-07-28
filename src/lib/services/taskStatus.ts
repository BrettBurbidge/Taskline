/**
 * Task status bookkeeping.
 *
 * `completedAt` must always agree with `status`. POST /api/tasks/:id/complete
 * has always stamped it, but the other write paths (the edit form, and both
 * PATCH endpoints) did not — so a task marked complete anywhere else was left
 * with completedAt = null and became invisible to punctuality analytics.
 *
 * Every path that can write `status` should route through this.
 */

/**
 * Work out the completedAt value to persist alongside a status change.
 *
 * - moving to 'completed' stamps now (unless already stamped, so re-saving an
 *   already-completed task doesn't reset when it was finished)
 * - moving away from 'completed' clears it
 * - an explicit completedAt from the caller always wins (lets an importer or the
 *   MCP set a historical completion time)
 * - returns `undefined` to mean "leave the column alone" when status isn't changing
 */
export function resolveCompletedAt(options: {
  /** The status being written, or undefined if the caller isn't setting one. */
  nextStatus?: string;
  /** What is currently stored on the task. */
  currentCompletedAt: Date | null;
  /** An explicit completedAt supplied by the caller, if any. */
  explicitCompletedAt?: Date | string | null;
  now?: Date;
}): Date | null | undefined {
  const { nextStatus, currentCompletedAt, explicitCompletedAt, now = new Date() } = options;

  if (explicitCompletedAt !== undefined && explicitCompletedAt !== null) {
    return new Date(explicitCompletedAt);
  }

  if (nextStatus === undefined) return undefined;

  if (nextStatus === 'completed') {
    return currentCompletedAt ?? now;
  }

  return null;
}
