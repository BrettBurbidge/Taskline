<script lang="ts">
  import type { PageData } from "./$types";
  import { summarizePunctuality, formatDelta } from "$lib/services/punctuality";
  import {
    summarizeTaskMix,
    formatMinutes,
    TASK_TYPES,
    type MixKey,
    type LeverageKey,
  } from "$lib/services/taskMix";
  import { rankMostPushed } from "$lib/services/taskAnalytics";
  import { getUserTimezone } from "$lib/utils/timezone";

  let { data }: { data: PageData } = $props();

  // All aggregation is client-side so it uses the browser's real timezone
  // (the server only knows DEFAULT_TIMEZONE) and so the toggles are instant.
  const timezone = getUserTimezone();

  // ---- Closing pace ----
  let paceWindow = $state<number | undefined>(undefined); // undefined = all time

  let pace = $derived(summarizePunctuality(data.tasks, timezone, paceWindow));

  let paceWindowLabel = $derived(
    paceWindow === undefined ? "all time" : `last ${paceWindow} days`
  );

  let totalCompleted = $derived(
    data.tasks.filter((t) => t.status === "completed").length
  );

  // ---- Task mix / leverage (shared window + measure across both panels) ----
  let mixWindow = $state<number | undefined>(undefined);
  let mixMeasure = $state<"time" | "count">("time");

  let completedMix = $derived(
    summarizeTaskMix(data.tasks, {
      population: "completed",
      timezone,
      windowDays: mixWindow,
    })
  );
  let openMix = $derived(summarizeTaskMix(data.tasks, { population: "open", timezone }));

  let mixWindowLabel = $derived(
    mixWindow === undefined ? "all time" : `last ${mixWindow} days`
  );

  const pct = (slice: { pctByTime: number; pctByCount: number }) =>
    mixMeasure === "time" ? slice.pctByTime : slice.pctByCount;

  // ---- Pushed down the road ----
  let pushedRanks = $derived(rankMostPushed(data.tasks, { timezone }));
  let pushedTwicePlus = $derived(
    data.tasks.filter(
      (t) =>
        t.status !== "completed" && t.status !== "cancelled" && t.dueAtChangeCount >= 2
    ).length
  );

  const WINDOW_OPTIONS = [
    { label: "All time", value: undefined },
    { label: "90 days", value: 90 },
    { label: "30 days", value: 30 },
  ];

  // Literal Tailwind classes only — never construct class names dynamically.
  const TYPE_META: Record<MixKey, { label: string; bar: string }> = {
    deep_work: { label: "Deep work", bar: "bg-indigo-500" },
    meeting: { label: "Meetings", bar: "bg-sky-500" },
    followup: { label: "Follow-ups", bar: "bg-teal-500" },
    admin: { label: "Admin", bar: "bg-amber-500" },
    errand: { label: "Errands", bar: "bg-orange-400" },
    other: { label: "Other", bar: "bg-gray-400" },
    unclassified: { label: "Unclassified", bar: "bg-gray-300" },
  };

  const LEVERAGE_META: Record<LeverageKey, { label: string; bar: string }> = {
    deep_work: { label: "Deep work", bar: "bg-indigo-600" },
    coordination: { label: "Coordination", bar: "bg-sky-500" },
    overhead: { label: "Overhead", bar: "bg-amber-500" },
    neutral: { label: "Other / unclassified", bar: "bg-gray-300" },
  };
</script>

<svelte:head>
  <title>Stats - Taskline</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Stats</h1>
          <p class="text-gray-600 mt-2">
            How you're actually getting work done over time
          </p>
        </div>
        <a
          href="/dashboard"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
        >
          <span>📊</span>
          <span>Dashboard</span>
        </a>
      </div>
    </div>

    <!-- Closing Pace -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Closing pace</h2>
          <p class="text-sm text-gray-600">
            How far from their due date tasks actually get closed
          </p>
        </div>
        <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {#each WINDOW_OPTIONS as option}
            <button
              type="button"
              onclick={() => (paceWindow = option.value)}
              class="px-3 py-1.5 text-sm font-medium transition-colors {paceWindow ===
              option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'}"
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>

      {#if pace.scored === 0}
        <div class="text-gray-500 py-4">
          Not enough data {paceWindow !== undefined ? `in the ${paceWindowLabel}` : "yet"} —
          complete a few tasks that have due dates and this will fill in.
          {#if pace.unscoreable > 0}
            <span class="block text-sm mt-1">
              {pace.unscoreable} completed task{pace.unscoreable === 1 ? "" : "s"}
              can't be scored (no due date).
            </span>
          {/if}
        </div>
      {:else}
        <div class="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div
              class="text-3xl font-bold {pace.medianDays === null ||
              pace.medianDays > 0
                ? 'text-red-700'
                : pace.medianDays < 0
                  ? 'text-green-700'
                  : 'text-gray-900'}"
            >
              {formatDelta(pace.medianDays)}
            </div>
            <div class="text-sm text-gray-600 mt-1">
              typical (median of {pace.scored} task{pace.scored === 1 ? "" : "s"})
            </div>
          </div>

          <div class="text-sm text-gray-600 space-y-1">
            <div>Average {formatDelta(pace.meanDays)}</div>
            <div>
              Best {formatDelta(pace.bestDays)} · worst {formatDelta(
                pace.worstDays
              )}
            </div>
          </div>
        </div>

        <!-- Distribution -->
        <div class="mt-5">
          <div class="flex h-2 rounded-full overflow-hidden bg-gray-100">
            {#if pace.early > 0}
              <div
                class="bg-green-500"
                style="width: {(pace.early / pace.scored) * 100}%"
              ></div>
            {/if}
            {#if pace.onTime > 0}
              <div
                class="bg-blue-500"
                style="width: {(pace.onTime / pace.scored) * 100}%"
              ></div>
            {/if}
            {#if pace.late > 0}
              <div
                class="bg-red-500"
                style="width: {(pace.late / pace.scored) * 100}%"
              ></div>
            {/if}
          </div>
          <div class="flex flex-wrap gap-4 mt-3 text-sm">
            <span class="inline-flex items-center gap-1.5 text-gray-700">
              <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              {pace.early} early
            </span>
            <span class="inline-flex items-center gap-1.5 text-gray-700">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              {pace.onTime} on time
            </span>
            <span class="inline-flex items-center gap-1.5 text-gray-700">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              {pace.late} late
            </span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
          {pace.scored} of {totalCompleted} completed task{totalCompleted === 1
            ? ""
            : "s"} scored ({paceWindowLabel}){#if pace.unscoreable > 0}
            · {pace.unscoreable} skipped for having no due date{/if}
        </div>
      {/if}
    </div>

    <!-- Where your time goes -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Where your time goes</h2>
          <p class="text-sm text-gray-600">
            What kind of work you're actually completing
          </p>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {#each [{ label: "Time", value: "time" }, { label: "Count", value: "count" }] as option}
              <button
                type="button"
                onclick={() => (mixMeasure = option.value as "time" | "count")}
                class="px-3 py-1.5 text-sm font-medium transition-colors {mixMeasure ===
                option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'}"
              >
                {option.label}
              </button>
            {/each}
          </div>
          <div class="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            {#each WINDOW_OPTIONS as option}
              <button
                type="button"
                onclick={() => (mixWindow = option.value)}
                class="px-3 py-1.5 text-sm font-medium transition-colors {mixWindow ===
                option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'}"
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if completedMix.total === 0}
        <div class="text-gray-500 py-4">
          No completed tasks {mixWindow !== undefined ? `in the ${mixWindowLabel}` : "yet"} —
          finish a few and this will fill in.
        </div>
      {:else}
        <div class="flex h-3 rounded-full overflow-hidden bg-gray-100">
          {#each completedMix.slices as slice}
            {#if slice.count > 0}
              <div class={TYPE_META[slice.key].bar} style="width: {pct(slice)}%"></div>
            {/if}
          {/each}
        </div>
        <div class="flex flex-wrap gap-4 mt-3 text-sm">
          {#each completedMix.slices as slice}
            {#if slice.count > 0}
              <span class="inline-flex items-center gap-1.5 text-gray-700">
                <span class="w-2.5 h-2.5 rounded-full {TYPE_META[slice.key].bar}"></span>
                {TYPE_META[slice.key].label}
                {Math.round(pct(slice))}%
                <span class="text-gray-400">
                  ({mixMeasure === "time" ? formatMinutes(slice.minutes) : slice.count})
                </span>
              </span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if openMix.total > 0}
        <div class="mt-6">
          <div class="flex items-baseline justify-between mb-2">
            <h3 class="text-sm font-medium text-gray-900">Open tasks right now</h3>
            <span class="text-xs text-gray-500">
              leading indicator — mix of what's currently on your plate ({openMix.total}
              task{openMix.total === 1 ? "" : "s"})
            </span>
          </div>
          <div class="flex h-2 rounded-full overflow-hidden bg-gray-100">
            {#each openMix.slices as slice}
              {#if slice.count > 0}
                <div class={TYPE_META[slice.key].bar} style="width: {pct(slice)}%"></div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <div class="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        {completedMix.total - completedMix.unclassified} of {completedMix.total} completed
        task{completedMix.total === 1 ? "" : "s"} classified ({mixWindowLabel})
        {#if completedMix.unclassifiedPct >= 25}
          <span class="block mt-1 text-amber-600">
            {Math.round(completedMix.unclassifiedPct)}% unclassified — edit tasks or run
            the backfill script to improve this.
          </span>
        {/if}
        {#if mixMeasure === "time" && completedMix.total > 0 && completedMix.withEstimate / completedMix.total < 0.5}
          <span class="block mt-1">
            Time shares are mostly estimated from typical durations.
          </span>
        {/if}
      </div>
    </div>

    <!-- Leverage lens -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Leverage lens</h2>
          <p class="text-sm text-gray-600">
            Creating, coordinating, or in the weeds — completed tasks · {mixWindowLabel}
          </p>
        </div>
      </div>

      {#if completedMix.total === 0}
        <div class="text-gray-500 py-4">
          No completed tasks {mixWindow !== undefined ? `in the ${mixWindowLabel}` : "yet"} —
          finish a few and this will fill in.
        </div>
      {:else}
        {@const neutral = completedMix.leverage.find((b) => b.key === "neutral")}
        <div class="flex flex-wrap items-end gap-x-10 gap-y-4">
          {#each completedMix.leverage.filter((b) => b.key !== "neutral") as bucket}
            <div>
              <div class="text-3xl font-bold text-gray-900">
                {Math.round(pct(bucket))}%
              </div>
              <div class="text-sm text-gray-600 mt-1">
                {LEVERAGE_META[bucket.key].label}
                <span class="text-gray-400">
                  ({mixMeasure === "time" ? formatMinutes(bucket.minutes) : bucket.count})
                </span>
              </div>
            </div>
          {/each}
          {#if neutral && neutral.count > 0}
            <div class="text-sm text-gray-500">
              +{Math.round(pct(neutral))}% other/unclassified
            </div>
          {/if}
        </div>

        <div class="mt-5">
          <div class="flex h-2 rounded-full overflow-hidden bg-gray-100">
            {#each completedMix.leverage as bucket}
              {#if bucket.count > 0}
                <div class={LEVERAGE_META[bucket.key].bar} style="width: {pct(bucket)}%"></div>
              {/if}
            {/each}
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span>
            Delegated {Math.round(completedMix.indicators.delegatedPct)}%
            ({completedMix.indicators.delegated})
          </span>
          <span>High priority {Math.round(completedMix.indicators.highPriorityPct)}%</span>
          <span>Project-linked {Math.round(completedMix.indicators.projectLinkedPct)}%</span>
        </div>
      {/if}
    </div>

    <!-- Pushed down the road -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Pushed down the road</h2>
          <p class="text-sm text-gray-600">
            Open tasks that keep getting rescheduled
          </p>
        </div>
        {#if pushedTwicePlus > 0}
          <div class="text-sm text-gray-600">
            <span class="font-semibold text-gray-900">{pushedTwicePlus}</span>
            open task{pushedTwicePlus === 1 ? "" : "s"} rescheduled 2+ times
          </div>
        {/if}
      </div>

      {#if pushedRanks.length === 0}
        <div class="text-gray-500 py-4">
          Nothing is getting pushed around — tasks are moving through on their first
          scheduling.
        </div>
      {:else}
        <ul class="divide-y divide-gray-100">
          {#each pushedRanks as rank}
            <li>
              <a
                href="/tasks/{rank.id}"
                class="flex items-center justify-between gap-4 py-2.5 group"
              >
                <span class="text-sm text-gray-900 group-hover:text-blue-700 truncate">
                  {rank.title}
                </span>
                <span class="flex items-center gap-2 shrink-0 text-xs">
                  {#if rank.dueAtChangeCount > 0}
                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      pushed {rank.dueAtChangeCount}×
                    </span>
                  {/if}
                  {#if rank.boardDayCount > 1}
                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                      on board {rank.boardDayCount} days
                    </span>
                  {/if}
                  {#if rank.slipDays !== null && rank.slipDays > 0}
                    <span class="px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                      slipped {rank.slipDays}d vs original
                    </span>
                  {/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
        <div class="mt-2 pt-3 border-t border-gray-100 text-xs text-gray-500">
          Click a task to see its full reschedule history in the activity timeline.
        </div>
      {/if}
    </div>
  </div>
</div>
