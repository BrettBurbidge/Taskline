<script lang="ts">
  import { parseISO } from "date-fns";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import { formatDateInUserTZ, getUserTimezone } from "$lib/utils/timezone";

  let { data }: { data: PageData } = $props();

  // --- Drag and drop ----------------------------------------------------------
  // Dragging a task onto a day sets both its board date and due date, so this
  // doubles as "reschedule an overdue task into this week".

  let draggedTaskId = $state<string | null>(null);
  // The day the task came from — null for the Overdue / No Due Date sections
  let draggedFromDate = $state<string | null>(null);
  let dragOverDate = $state<string | null>(null);
  let movingTaskId = $state<string | null>(null);
  let moveError = $state("");

  function handleDragStart(e: DragEvent, taskId: string, fromDate: string | null) {
    draggedTaskId = taskId;
    draggedFromDate = fromDate;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      // These cards are links, so the browser would otherwise drag the href
      e.dataTransfer.setData("text/plain", taskId);
    }
  }

  function handleDragEnd() {
    draggedTaskId = null;
    draggedFromDate = null;
    dragOverDate = null;
  }

  function handleDragOver(e: DragEvent, date: string) {
    if (!draggedTaskId) return;
    e.preventDefault(); // required for the drop to be allowed
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dragOverDate = date;
  }

  function handleDragLeave(e: DragEvent, date: string) {
    // Moving onto a child element fires dragleave on the parent — ignore those
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    if (dragOverDate === date) dragOverDate = null;
  }

  async function handleDrop(e: DragEvent, date: string) {
    e.preventDefault();

    const taskId = draggedTaskId || e.dataTransfer?.getData("text/plain") || "";
    const fromDate = draggedFromDate;
    handleDragEnd();

    // Nothing to do if it was dropped back on the day it came from
    if (!taskId || fromDate === date) return;

    movingTaskId = taskId;
    moveError = "";

    try {
      const response = await fetch(`/api/tasks/${taskId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardDate: date, timezone: getUserTimezone() }),
      });

      if (!response.ok) {
        throw new Error("Failed to move task");
      }

      await invalidateAll();
    } catch (err) {
      moveError =
        err instanceof Error ? err.message : "Failed to move task";
    } finally {
      movingTaskId = null;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "not_started":
        return "border-l-gray-400";
      case "in_progress":
        return "border-l-blue-500";
      case "waiting":
        return "border-l-yellow-500";
      case "completed":
        return "border-l-green-500";
      default:
        return "border-l-gray-400";
    }
  }

  function getDayName(dateStr: string) {
    return formatDateInUserTZ(parseISO(dateStr), "EEE");
  }

  function getDayNumber(dateStr: string) {
    return formatDateInUserTZ(parseISO(dateStr), "d");
  }

  function isToday(dateStr: string) {
    const today = formatDateInUserTZ(new Date(), "yyyy-MM-dd");
    return dateStr === today;
  }

  function getWeekLabel(offset: number): string {
    if (offset === 0) return "This Week";
    if (offset === 1) return "Next Week";
    if (offset === -1) return "Last Week";
    if (offset > 1) return `${offset} Weeks Ahead`;
    return `${Math.abs(offset)} Weeks Ago`;
  }
</script>

<div class="py-8">
  <div class="max-w-7xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Week View</h1>
        <p class="text-gray-600 mt-2">
          {formatDateInUserTZ(parseISO(data.weekStart), "MMM d")} - {formatDateInUserTZ(
            parseISO(data.weekEnd),
            "MMM d, yyyy"
          )}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <a
          href="/inbox"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Add Task
        </a>
      </div>
    </div>

    <!-- Week Navigation -->
    <div
      class="mb-6 flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4"
    >
      <a
        href="/week?offset={data.weekOffset - 1}"
        class="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
      >
        ← Previous Week
      </a>

      <div class="flex items-center gap-4">
        {#if data.weekOffset !== 0}
          <a
            href="/week"
            class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
          >
            This Week
          </a>
        {/if}
        <div class="text-center">
          <div class="text-sm text-gray-600">
            {getWeekLabel(data.weekOffset)}
          </div>
          <div class="text-lg font-bold text-gray-900">
            {formatDateInUserTZ(parseISO(data.weekStart), "MMM d")} - {formatDateInUserTZ(
              parseISO(data.weekEnd),
              "MMM d"
            )}
          </div>
        </div>
      </div>

      <a
        href="/week?offset={data.weekOffset + 1}"
        class="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
      >
        Next Week →
      </a>
    </div>

    {#if moveError}
      <div
        class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between gap-4"
      >
        <span>{moveError}</span>
        <button
          type="button"
          onclick={() => (moveError = "")}
          class="text-sm font-medium text-red-600 hover:text-red-800"
        >
          Dismiss
        </button>
      </div>
    {/if}

    <!-- Overdue Tasks -->
    {#if data.overdueTasks.length > 0}
      <div class="mb-6 bg-red-50 rounded-lg border border-red-200 p-4">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-lg font-semibold text-red-900">
            ⚠️ Overdue ({data.overdueTasks.length})
          </h2>
          <span class="text-sm text-red-700">
            Drag onto a day to reschedule
          </span>
        </div>
        <div class="space-y-2">
              {#each data.overdueTasks as task}
            <a
              href="/tasks/{task.id}"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, task.id, null)}
              ondragend={handleDragEnd}
              class="block bg-white p-3 rounded border-l-4 {getStatusColor(
                task.status
              )} shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing {task.status === 'completed' ? 'opacity-75' : ''} {movingTaskId ===
              task.id
                ? 'opacity-40'
                : ''} {draggedTaskId === task.id ? 'ring-2 ring-red-300' : ''}"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="font-medium text-gray-900 {task.status === 'completed' ? 'line-through' : ''}">{task.title}</h3>
                  <div
                    class="flex items-center gap-3 mt-1 text-sm text-gray-600"
                  >
                    {#if task.dueAt}
                      <span>📅 {formatDateInUserTZ(task.dueAt, "MMM d")}</span>
                    {/if}
                    {#if task.project}
                      <span>📁 {task.project.name}</span>
                    {/if}
                    <span class="text-xs px-2 py-0.5 bg-gray-100 rounded">
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <span class="text-sm text-blue-600"> View → </span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Week Grid -->
    <div class="grid grid-cols-1 md:grid-cols-7 gap-4">
      {#each data.weekDates as date}
        <div
          role="group"
          aria-label="Tasks for {formatDateInUserTZ(
            parseISO(date),
            'EEEE, MMM d'
          )}"
          ondragover={(e) => handleDragOver(e, date)}
          ondragleave={(e) => handleDragLeave(e, date)}
          ondrop={(e) => handleDrop(e, date)}
          class="bg-white rounded-lg border overflow-hidden transition-colors {dragOverDate ===
          date
            ? 'border-blue-500 ring-2 ring-blue-300 bg-blue-50'
            : isToday(date)
              ? 'border-blue-500 ring-2 ring-blue-100'
              : 'border-gray-200'}"
        >
          <a
            href="/day/{date}"
            class="block p-3 {isToday(date)
              ? 'bg-blue-50 border-b border-blue-200'
              : 'bg-gray-50 border-b border-gray-200'} hover:bg-opacity-80 transition-colors"
          >
            <div class="text-xs font-medium text-gray-600">
              {getDayName(date)}
            </div>
            <div
              class="text-2xl font-bold {isToday(date)
                ? 'text-blue-600'
                : 'text-gray-900'}"
            >
              {getDayNumber(date)}
            </div>
            <div class="text-xs text-gray-500 mt-1">
              {#if data.tasksByDate[date]}
                {data.tasksByDate[date].length} task{data.tasksByDate[date]
                  .length !== 1
                  ? "s"
                  : ""}
              {:else}
                View day →
              {/if}
            </div>
          </a>

          <div class="p-3 space-y-2 min-h-[200px]">
            {#if data.tasksByDate[date] && data.tasksByDate[date].length > 0}
              {#each data.tasksByDate[date] as task}
                <a
                  href="/tasks/{task.id}"
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, task.id, date)}
                  ondragend={handleDragEnd}
                  class="block p-2 bg-gray-50 rounded border-l-4 {getStatusColor(
                    task.status
                  )} hover:bg-gray-100 transition-colors cursor-grab active:cursor-grabbing {task.status === 'completed' ? 'opacity-75' : ''} {movingTaskId ===
                  task.id
                    ? 'opacity-40'
                    : ''} {draggedTaskId === task.id
                    ? 'ring-2 ring-blue-300'
                    : ''}"
                >
                  <h4 class="text-sm font-medium text-gray-900 line-clamp-2 {task.status === 'completed' ? 'line-through' : ''}">
                    {task.title}
                  </h4>
                  <div class="flex items-center gap-2 mt-1">
                    {#if task.project}
                      <span class="text-xs text-gray-500">
                        {task.project.name}
                      </span>
                    {/if}
                    {#if task.executorPerson && task.executorPerson.id !== task.accountablePerson.id}
                      <span class="text-xs text-gray-500">
                        → @{task.executorPerson.handle}
                      </span>
                    {/if}
                  </div>
                </a>
              {/each}
            {:else}
              <div class="text-center text-gray-400 text-sm pt-8">
                {#if dragOverDate === date}
                  Drop to schedule here
                {:else}
                  No tasks
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- No Due Date Tasks -->
    {#if data.noDueDateTasks.length > 0}
      <div class="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-lg font-semibold text-gray-900">
            No Due Date ({data.noDueDateTasks.length})
          </h2>
          <span class="text-sm text-gray-600">Drag onto a day to schedule</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each data.noDueDateTasks as task}
            <a
              href="/tasks/{task.id}"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, task.id, null)}
              ondragend={handleDragEnd}
              class="block bg-white p-3 rounded border-l-4 {getStatusColor(
                task.status
              )} shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing {task.status === 'completed' ? 'opacity-75' : ''} {movingTaskId ===
              task.id
                ? 'opacity-40'
                : ''} {draggedTaskId === task.id
                ? 'ring-2 ring-gray-400'
                : ''}"
            >
              <h3 class="font-medium text-gray-900 {task.status === 'completed' ? 'line-through' : ''}">{task.title}</h3>
              <div class="flex items-center gap-3 mt-1 text-sm text-gray-600">
                {#if task.project}
                  <span>📁 {task.project.name}</span>
                {/if}
                <span class="text-xs px-2 py-0.5 bg-gray-100 rounded">
                  {task.status.replace("_", " ")}
                </span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
