<script lang="ts">
  import { addDays, format, parseISO } from "date-fns";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import { formatDateInUserTZ, getTodayString } from "$lib/utils/timezone";

  let { data }: { data: PageData } = $props();

  let showMoveDatePicker = $state<string | null>(null);
  let moveToDate = $state("");
  let rollingOver = $state(false);
  let generatingFollowUps = $state(false);
  let showFollowUpInfoModal = $state(false);
  let followUpInfoMessage = $state("");

  async function reorderTask(taskId: string, direction: "up" | "down") {
    try {
      await fetch(`/api/tasks/${taskId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to reorder task:", err);
    }
  }

  async function completeTask(taskId: string) {
    try {
      await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  }

  async function moveTask(taskId: string, boardDate: string) {
    try {
      await fetch(`/api/tasks/${taskId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardDate }),
      });
      showMoveDatePicker = null;
      await invalidateAll();
    } catch (err) {
      console.error("Failed to move task:", err);
    }
  }

  async function rolloverTasks() {
    if (!confirm("Move all incomplete tasks to tomorrow?")) return;

    rollingOver = true;
    try {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
      await fetch("/api/board/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDate: data.todayDate,
          toDate: tomorrow,
        }),
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to rollover:", err);
    } finally {
      rollingOver = false;
    }
  }

  async function completeFollowUp(followUpId: string) {
    try {
      await fetch(`/api/followups/${followUpId}/complete`, {
        method: "POST",
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to complete follow-up:", err);
    }
  }

  async function snoozeFollowUp(followUpId: string, days: number) {
    try {
      const until = format(addDays(new Date(), days), "yyyy-MM-dd");
      await fetch(`/api/followups/${followUpId}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until }),
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to snooze follow-up:", err);
    }
  }

  async function generateFollowUps() {
    generatingFollowUps = true;
    try {
      const response = await fetch("/api/followups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardDate: data.todayDate }),
      });

      const result = await response.json();
      await invalidateAll();

      // Show feedback modal
      if (result.count === 0) {
        followUpInfoMessage = "no_followups";
        showFollowUpInfoModal = true;
      } else {
        followUpInfoMessage = `success:${result.count}`;
        showFollowUpInfoModal = true;
      }
    } catch (err) {
      console.error("Failed to generate follow-ups:", err);
      followUpInfoMessage = "error";
      showFollowUpInfoModal = true;
    } finally {
      generatingFollowUps = false;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "not_started":
        return "bg-gray-100 text-gray-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "waiting":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function formatFollowUpType(type: string) {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
</script>

<div class="py-8">
  <div class="max-w-6xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Daily Board</h1>
        <p class="text-gray-600 mt-2">
          {formatDateInUserTZ(parseISO(data.todayDate), "EEEE, MMMM d, yyyy")}
        </p>
      </div>
      <div class="flex gap-3">
        <a
          href="/inbox"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Add Task
        </a>
        <button
          onclick={generateFollowUps}
          disabled={generatingFollowUps}
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
        >
          {generatingFollowUps ? "Generating..." : "🔔 Generate Follow-ups"}
        </button>
        <button
          onclick={rolloverTasks}
          disabled={rollingOver || data.scheduledTasks.length === 0}
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rollingOver ? "Rolling over..." : "→ Rollover to Tomorrow"}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Tasks Column -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Due/Overdue Tasks -->
        {#if data.dueTasks.length > 0}
          <div class="bg-red-50 rounded-lg shadow-sm border border-red-200">
            <div class="p-4 border-b border-red-200">
              <h2 class="text-lg font-semibold text-red-900">
                ⚠️ Due Today / Overdue
                <span class="ml-2 text-sm font-normal text-red-700"
                  >({data.dueTasks.length})</span
                >
              </h2>
            </div>

            <div class="divide-y divide-red-100">
              {#each data.dueTasks as task, index}
                <div class="p-4 hover:bg-red-100 transition-colors">
                  <div class="flex items-start gap-4">
                    <!-- Task Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                          <h3 class="font-medium text-gray-900">
                            <a
                              href="/tasks/{task.id}"
                              class="hover:text-blue-600 hover:underline transition-colors"
                            >
                              {task.title}
                            </a>
                          </h3>
                          {#if task.description}
                            <p class="text-sm text-gray-600 mt-1">
                              {task.description}
                            </p>
                          {/if}
                          <div class="flex items-center gap-3 mt-2 text-sm">
                            <span
                              class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(
                                task.status
                              )}"
                            >
                              {task.status.replace("_", " ")}
                            </span>
                            {#if task.project}
                              <span class="text-gray-500">
                                📁 {task.project.name}
                              </span>
                            {/if}
                            {#if task.dueAt}
                              <span class="text-red-600 font-medium">
                                📅 {formatDateInUserTZ(task.dueAt, "MMM d")}
                              </span>
                            {/if}
                            {#if task.executorPerson && task.executorPerson.id !== task.accountablePerson.id}
                              <span class="text-gray-500">
                                → @{task.executorPerson.handle}
                              </span>
                            {/if}
                            {#if task.stakeholders.length > 0}
                              <span class="text-gray-500">
                                👥 {task.stakeholders.length}
                              </span>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-col gap-2">
                      <button
                        onclick={() => completeTask(task.id)}
                        class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        ✓ Complete
                      </button>
                      <a
                        href="/tasks/{task.id}"
                        class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-center"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Scheduled Tasks for Today -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              Scheduled for Today
              <span class="ml-2 text-sm font-normal text-gray-500"
                >({data.scheduledTasks.length})</span
              >
            </h2>
          </div>

          {#if data.scheduledTasks.length === 0}
            <div class="p-12 text-center">
              <div class="text-4xl mb-4">🎉</div>
              <p class="text-gray-600 mb-4">No tasks for today!</p>
              <a
                href="/inbox"
                class="text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first task →
              </a>
            </div>
          {:else}
            <div class="divide-y divide-gray-200">
              {#each data.scheduledTasks as task, index}
                <div class="p-4 hover:bg-gray-50 transition-colors">
                  <div class="flex items-start gap-4">
                    <!-- Reorder Controls -->
                    <div class="flex flex-col gap-1 pt-1">
                      <button
                        onclick={() => reorderTask(task.id, "up")}
                        disabled={index === 0}
                        class="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onclick={() => reorderTask(task.id, "down")}
                        disabled={index === data.scheduledTasks.length - 1}
                        class="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    <!-- Task Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                          <h3 class="font-medium text-gray-900">
                            <a
                              href="/tasks/{task.id}"
                              class="hover:text-blue-600 hover:underline transition-colors"
                            >
                              {task.title}
                            </a>
                          </h3>
                          {#if task.description}
                            <p class="text-sm text-gray-600 mt-1">
                              {task.description}
                            </p>
                          {/if}
                          <div class="flex items-center gap-3 mt-2 text-sm">
                            <span
                              class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(
                                task.status
                              )}"
                            >
                              {task.status.replace("_", " ")}
                            </span>
                            {#if task.project}
                              <span class="text-gray-500">
                                📁 {task.project.name}
                              </span>
                            {/if}
                            {#if task.dueAt}
                              <span class="text-gray-500">
                                📅 {formatDateInUserTZ(task.dueAt, "MMM d")}
                              </span>
                            {/if}
                            {#if task.executorPerson && task.executorPerson.id !== task.accountablePerson.id}
                              <span class="text-gray-500">
                                → @{task.executorPerson.handle}
                              </span>
                            {/if}
                            {#if task.stakeholders.length > 0}
                              <span class="text-gray-500">
                                👥 {task.stakeholders.length}
                              </span>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-col gap-2">
                      <button
                        onclick={() => completeTask(task.id)}
                        class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        ✓ Complete
                      </button>
                      <div class="relative">
                        {#if showMoveDatePicker === task.id}
                          <div
                            class="absolute right-0 top-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-10 min-w-[200px]"
                          >
                            <div class="space-y-2">
                              <button
                                onclick={() =>
                                  moveTask(task.id, getTodayString())}
                                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                Tomorrow
                              </button>
                              <button
                                onclick={() => {
                                  const nextWeek = addDays(new Date(), 7);
                                  moveTask(
                                    task.id,
                                    formatDateInUserTZ(nextWeek, "yyyy-MM-dd")
                                  );
                                }}
                                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                              >
                                Next week
                              </button>
                              <div class="border-t border-gray-200 pt-2">
                                <input
                                  type="date"
                                  bind:value={moveToDate}
                                  class="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                                <button
                                  onclick={() => moveTask(task.id, moveToDate)}
                                  disabled={!moveToDate}
                                  class="w-full mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Move to date
                                </button>
                              </div>
                              <button
                                onclick={() => (showMoveDatePicker = null)}
                                class="w-full px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        {:else}
                          <button
                            onclick={() => (showMoveDatePicker = task.id)}
                            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            → Move
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Follow-ups Sidebar -->
      <div class="space-y-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              Follow-ups
              <span class="ml-2 text-sm font-normal text-gray-500"
                >({data.followUps.length})</span
              >
            </h2>
          </div>

          {#if data.followUps.length === 0}
            <div class="p-6 text-center text-gray-500 text-sm">
              No follow-ups due today
            </div>
          {:else}
            <div class="divide-y divide-gray-200">
              {#each data.followUps as followUp}
                <div class="p-4">
                  <a
                    href="/tasks/{followUp.taskId}"
                    class="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline mb-1 block"
                  >
                    {followUp.task.title}
                  </a>
                  <div class="text-xs text-gray-600 mb-2">
                    {formatFollowUpType(followUp.followUpType)}
                    {#if followUp.targetPerson}
                      → @{followUp.targetPerson.handle}
                    {/if}
                  </div>
                  <div class="flex gap-2 mt-2">
                    <button
                      onclick={() => completeFollowUp(followUp.id)}
                      class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Done
                    </button>
                    <button
                      onclick={() => snoozeFollowUp(followUp.id, 1)}
                      class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      +1d
                    </button>
                    <button
                      onclick={() => snoozeFollowUp(followUp.id, 3)}
                      class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      +3d
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Quick Stats -->
        <div class="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 class="text-sm font-semibold text-blue-900 mb-3">
            Today's Progress
          </h3>
          <div class="space-y-2 text-sm text-blue-800">
            {#if data.dueTasks.length > 0}
              <div class="flex justify-between">
                <span>Due/Overdue:</span>
                <span class="font-medium text-red-600"
                  >{data.dueTasks.length}</span
                >
              </div>
            {/if}
            <div class="flex justify-between">
              <span>Scheduled:</span>
              <span class="font-medium">{data.scheduledTasks.length}</span>
            </div>
            <div class="flex justify-between">
              <span>Follow-ups:</span>
              <span class="font-medium">{data.followUps.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Follow-up Info Modal -->
  {#if showFollowUpInfoModal}
    <div
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        {#if followUpInfoMessage === "no_followups"}
          <!-- No Follow-ups Generated -->
          <div class="mb-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="text-4xl">ℹ️</div>
              <h2 class="text-xl font-bold text-gray-900">
                No Follow-ups Generated
              </h2>
            </div>

            <div class="space-y-4 text-gray-700">
              <p class="font-medium">
                Follow-ups are only created for tasks due in the <strong
                  >future</strong
                > (tomorrow or later).
              </p>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 class="font-semibold text-blue-900 mb-2">Why?</h3>
                <ul class="text-sm text-blue-800 space-y-2">
                  <li>
                    • <strong>Tasks due today or overdue</strong> are already visible
                    on your board
                  </li>
                  <li>
                    • <strong>Follow-ups are for proactive check-ins</strong> on
                    future work
                  </li>
                  <li>
                    • No need for reminders about tasks you're already working
                    on!
                  </li>
                </ul>
              </div>

              <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 class="font-semibold text-green-900 mb-2">
                  💡 To generate follow-ups:
                </h3>
                <p class="text-sm text-green-800">
                  Make sure you have active tasks with due dates in the future
                  (tomorrow or later). The system scans ALL your active tasks,
                  not just today's board.
                </p>
              </div>
            </div>
          </div>
        {:else if followUpInfoMessage.startsWith("success:")}
          <!-- Success -->
          <div class="mb-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="text-4xl">✅</div>
              <h2 class="text-xl font-bold text-gray-900">
                Follow-ups Generated!
              </h2>
            </div>

            <div class="space-y-4 text-gray-700">
              <p class="text-lg">
                Created <strong class="text-green-600"
                  >{followUpInfoMessage.split(":")[1]} follow-up(s)</strong
                > for all your active tasks with future due dates.
              </p>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 class="font-semibold text-blue-900 mb-2">
                  📅 When will they appear?
                </h3>
                <p class="text-sm text-blue-800">
                  Follow-ups will appear in the "Follow-ups" sidebar when
                  they're due. Frequency is based on how urgent the task is
                  (daily for tasks due soon, weekly for tasks due later).
                </p>
              </div>
            </div>
          </div>
        {:else if followUpInfoMessage === "error"}
          <!-- Error -->
          <div class="mb-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="text-4xl">⚠️</div>
              <h2 class="text-xl font-bold text-gray-900">Error</h2>
            </div>

            <p class="text-gray-700">
              Failed to generate follow-ups. Please try again.
            </p>
          </div>
        {/if}

        <!-- Close Button -->
        <div class="flex justify-end">
          <button
            onclick={() => (showFollowUpInfoModal = false)}
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
