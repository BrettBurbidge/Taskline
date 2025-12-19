<script lang="ts">
  import { addDays, format, parseISO } from "date-fns";
  import { invalidateAll, goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import { formatDateInUserTZ, getUserTimezone } from "$lib/utils/timezone";

  let { data }: { data: PageData } = $props();

  async function reorderTask(taskId: string, direction: "up" | "down", targetDate?: string) {
    try {
      await fetch(`/api/tasks/${taskId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, targetDate, timezone: getUserTimezone() }),
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

  function navigateDay(offset: number) {
    const currentDate = parseISO(data.date);
    const newDate = addDays(currentDate, offset);
    const dateString = format(newDate, "yyyy-MM-dd");
    goto(`/day/${dateString}`);
  }

  function goToToday() {
    goto("/board");
  }

  function isToday(dateStr: string) {
    const today = format(new Date(), "yyyy-MM-dd");
    return dateStr === today;
  }
</script>

<div class="py-8">
  <div class="max-w-6xl mx-auto px-4">
    <!-- Header with Navigation -->
    <div class="mb-8">
      <div class="flex items-center text-sm text-gray-600 mb-3">
        <a href="/week" class="hover:text-gray-900">Week View</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900">Day View</span>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            onclick={() => navigateDay(-1)}
            class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Previous day"
          >
            ←
          </button>

          <div>
            <h1 class="text-3xl font-bold text-gray-900">
              {formatDateInUserTZ(parseISO(data.date), "EEEE")}
            </h1>
            <p class="text-gray-600 mt-1">
              {formatDateInUserTZ(parseISO(data.date), "MMMM d, yyyy")}
              {#if isToday(data.date)}
                <span
                  class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded"
                >
                  Today
                </span>
              {/if}
            </p>
          </div>

          <button
            onclick={() => navigateDay(1)}
            class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Next day"
          >
            →
          </button>
        </div>

        <div class="flex gap-3">
          {#if !isToday(data.date)}
            <button
              onclick={goToToday}
              class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
            >
              Go to Today
            </button>
          {/if}
          <a
            href="/inbox"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add Task
          </a>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Tasks Column -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Due on This Day -->
        {#if data.dueTasks.length > 0}
          <div
            class="bg-orange-50 rounded-lg shadow-sm border border-orange-200"
          >
            <div class="p-4 border-b border-orange-200">
              <h2 class="text-lg font-semibold text-orange-900">
                📅 Due on This Day
                <span class="ml-2 text-sm font-normal text-orange-700"
                  >({data.dueTasks.length})</span
                >
              </h2>
            </div>

            <div class="divide-y divide-orange-100">
              {#each data.dueTasks as task, index}
                <div class="p-4 hover:bg-orange-100 transition-colors">
                  <div class="flex items-start gap-4">
                    <!-- Reorder Controls -->
                    <div class="flex flex-col gap-1 pt-1">
                      <button
                        onclick={() => reorderTask(task.id, "up", data.targetDate)}
                        disabled={index === 0}
                        class="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onclick={() => reorderTask(task.id, "down", data.targetDate)}
                        disabled={index === data.dueTasks.length - 1}
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

        <!-- Scheduled for This Day -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">
              📋 Scheduled for This Day
              <span class="ml-2 text-sm font-normal text-gray-500"
                >({data.scheduledTasks.length})</span
              >
            </h2>
          </div>

          {#if data.scheduledTasks.length === 0}
            <div class="p-12 text-center">
              <div class="text-4xl mb-4">📅</div>
              <p class="text-gray-600 mb-4">No tasks scheduled for this day</p>
              <a
                href="/inbox"
                class="text-blue-600 hover:text-blue-700 font-medium"
              >
                Add a task →
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
                        onclick={() => reorderTask(task.id, "up", data.targetDate)}
                        disabled={index === 0}
                        class="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onclick={() => reorderTask(task.id, "down", data.targetDate)}
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
              No follow-ups due on this day
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
          <h3 class="text-sm font-semibold text-blue-900 mb-3">Day Summary</h3>
          <div class="space-y-2 text-sm text-blue-800">
            {#if data.dueTasks.length > 0}
              <div class="flex justify-between">
                <span>Due:</span>
                <span class="font-medium text-orange-600"
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
            <div class="flex justify-between pt-2 border-t border-blue-200">
              <span>Total:</span>
              <span class="font-bold"
                >{data.dueTasks.length +
                  data.scheduledTasks.length +
                  data.followUps.length}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
