/**
 * Task mix analytics — what KIND of work the user does, and how high-leverage
 * it is.
 *
 * Shared by the stats page (client-side, real browser timezone) and
 * GET /api/v1/reports/task-mix (server-side, DEFAULT_TIMEZONE) so the two can
 * never disagree.
 *
 * Two populations:
 * - 'completed'  — tasks completed in the (optional) trailing window: where the
 *                  time actually went.
 * - 'open'       — a snapshot of everything not completed/cancelled: where the
 *                  time is about to go. `windowDays` is deliberately ignored
 *                  here; a snapshot has no meaningful window.
 *
 * Time shares come from `estimatedMinutes`. Tasks without an estimate borrow
 * one so they don't drop out of a time-weighted view: own value → the median of
 * real estimates for their type → the global median → DEFAULT_ESTIMATED_MINUTES.
 * Medians are computed over the ENTIRE input array (every row with a real
 * estimate, regardless of status or window) so the 30/90-day toggle can't make
 * the fallback jitter, and sparse windows still get a usable prior.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { utcToDateString } from '$lib/utils/timezone';

export const TASK_TYPES = [
  'deep_work',
  'meeting',
  'followup',
  'admin',
  'errand',
  'other',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];
export type MixKey = TaskType | 'unclassified';

/** Last-resort minutes estimate when nothing real exists to borrow from. */
export const DEFAULT_ESTIMATED_MINUTES = 30;

/**
 * Leverage rollup. Coordination (meetings, follow-ups — driving other people's
 * work) is deliberately not "overhead": multiplying through others is leverage.
 */
export type LeverageKey = 'deep_work' | 'coordination' | 'overhead' | 'neutral';

const LEVERAGE_OF: Record<MixKey, LeverageKey> = {
  deep_work: 'deep_work',
  meeting: 'coordination',
  followup: 'coordination',
  admin: 'overhead',
  errand: 'overhead',
  other: 'neutral',
  unclassified: 'neutral',
};

const LEVERAGE_KEYS: LeverageKey[] = ['deep_work', 'coordination', 'overhead', 'neutral'];

/** The minimal shape needed — both callers can pass their query results as-is. */
export interface TaskMixTask {
  status: string;
  completedAt: Date | string | null;
  taskType: string | null;
  estimatedMinutes: number | null;
  priority: string | null;
  projectId: string | null;
  accountablePersonId: string;
  executorPersonId: string | null;
}

export interface TypeSlice {
  key: MixKey;
  count: number;
  /** Total estimated minutes with fallbacks applied. */
  minutes: number;
  /** How many of `count` had a real estimatedMinutes (coverage signal). */
  estimated: number;
  /** 0–100. 0 when the population is empty — never NaN. */
  pctByCount: number;
  pctByTime: number;
}

export interface LeverageBucket {
  key: LeverageKey;
  count: number;
  minutes: number;
  pctByCount: number;
  pctByTime: number;
}

export interface MixIndicators {
  /** executorPersonId set AND different from accountablePersonId. */
  delegated: number;
  delegatedPct: number;
  highPriority: number;
  highPriorityPct: number;
  projectLinked: number;
  projectLinkedPct: number;
}

export interface TaskMixSummary {
  /** Tasks in the population after filtering/windowing. */
  total: number;
  totalMinutes: number;
  /** Rows with a real estimatedMinutes. */
  withEstimate: number;
  unclassified: number;
  unclassifiedPct: number;
  /** Always all 7 keys, TASK_TYPES order then 'unclassified'. */
  slices: TypeSlice[];
  /** Always all 4 buckets: deep_work, coordination, overhead, neutral. */
  leverage: LeverageBucket[];
  indicators: MixIndicators;
}

/** Normalize a stored taskType (untyped text column) to a MixKey. */
function mixKeyOf(taskType: string | null): MixKey {
  return (TASK_TYPES as readonly string[]).includes(taskType ?? '')
    ? (taskType as TaskType)
    : 'unclassified';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Median of real estimatedMinutes per type (and globally), computed over ALL
 * input rows — see the module doc for why the window is ignored here.
 */
export function medianMinutesByType(tasks: TaskMixTask[]): {
  perType: Partial<Record<MixKey, number>>;
  global: number | null;
} {
  const byType = new Map<MixKey, number[]>();
  const all: number[] = [];

  for (const task of tasks) {
    if (task.estimatedMinutes === null || task.estimatedMinutes <= 0) continue;
    const key = mixKeyOf(task.taskType);
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(task.estimatedMinutes);
    all.push(task.estimatedMinutes);
  }

  const perType: Partial<Record<MixKey, number>> = {};
  for (const [key, values] of byType) {
    perType[key] = median(values)!;
  }

  return { perType, global: median(all) };
}

/**
 * Aggregate the task-type mix for one population.
 *
 * `windowDays` limits the 'completed' population to tasks completed within the
 * last N calendar days (inclusive, same mechanics as summarizePunctuality);
 * completed rows with no completedAt drop out when a window is active.
 */
export function summarizeTaskMix(
  tasks: TaskMixTask[],
  opts: {
    population: 'completed' | 'open';
    timezone?: string;
    windowDays?: number;
    asOf?: Date;
  }
): TaskMixSummary {
  const { population, timezone, windowDays, asOf = new Date() } = opts;

  // Fallback medians come from the full input, not the filtered population.
  const medians = medianMinutesByType(tasks);

  let candidates =
    population === 'completed'
      ? tasks.filter((t) => t.status === 'completed')
      : tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  if (population === 'completed' && windowDays !== undefined) {
    const today = utcToDateString(asOf, timezone);
    candidates = candidates.filter((t) => {
      if (!t.completedAt) return false;
      const doneDay = utcToDateString(t.completedAt, timezone);
      if (!doneDay) return false;
      const age = differenceInCalendarDays(parseISO(today), parseISO(doneDay));
      return age <= windowDays;
    });
  }

  const minutesOf = (task: TaskMixTask): number => {
    if (task.estimatedMinutes !== null && task.estimatedMinutes > 0) {
      return task.estimatedMinutes;
    }
    const key = mixKeyOf(task.taskType);
    return medians.perType[key] ?? medians.global ?? DEFAULT_ESTIMATED_MINUTES;
  };

  const sliceKeys: MixKey[] = [...TASK_TYPES, 'unclassified'];
  const byKey = new Map<MixKey, { count: number; minutes: number; estimated: number }>(
    sliceKeys.map((key) => [key, { count: 0, minutes: 0, estimated: 0 }])
  );

  let totalMinutes = 0;
  let withEstimate = 0;
  let delegated = 0;
  let highPriority = 0;
  let projectLinked = 0;

  for (const task of candidates) {
    const key = mixKeyOf(task.taskType);
    const minutes = minutesOf(task);
    const bucket = byKey.get(key)!;

    bucket.count += 1;
    bucket.minutes += minutes;
    totalMinutes += minutes;

    if (task.estimatedMinutes !== null && task.estimatedMinutes > 0) {
      bucket.estimated += 1;
      withEstimate += 1;
    }
    if (task.executorPersonId && task.executorPersonId !== task.accountablePersonId) {
      delegated += 1;
    }
    if (task.priority === 'high') highPriority += 1;
    if (task.projectId) projectLinked += 1;
  }

  const total = candidates.length;
  const pctOfCount = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const pctOfTime = (m: number) => (totalMinutes === 0 ? 0 : (m / totalMinutes) * 100);

  const slices: TypeSlice[] = sliceKeys.map((key) => {
    const { count, minutes, estimated } = byKey.get(key)!;
    return {
      key,
      count,
      minutes,
      estimated,
      pctByCount: pctOfCount(count),
      pctByTime: pctOfTime(minutes),
    };
  });

  const leverage: LeverageBucket[] = LEVERAGE_KEYS.map((key) => {
    const members = slices.filter((s) => LEVERAGE_OF[s.key] === key);
    const count = members.reduce((sum, s) => sum + s.count, 0);
    const minutes = members.reduce((sum, s) => sum + s.minutes, 0);
    return {
      key,
      count,
      minutes,
      pctByCount: pctOfCount(count),
      pctByTime: pctOfTime(minutes),
    };
  });

  const unclassified = byKey.get('unclassified')!.count;

  return {
    total,
    totalMinutes,
    withEstimate,
    unclassified,
    unclassifiedPct: pctOfCount(unclassified),
    slices,
    leverage,
    indicators: {
      delegated,
      delegatedPct: pctOfCount(delegated),
      highPriority,
      highPriorityPct: pctOfCount(highPriority),
      projectLinked,
      projectLinkedPct: pctOfCount(projectLinked),
    },
  };
}

/**
 * Phrase minutes for display.
 *
 * formatMinutes(45)  -> "45m"
 * formatMinutes(200) -> "3h 20m"
 * formatMinutes(720) -> "12h"
 */
export function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole}m`;

  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
