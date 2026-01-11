<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import { format } from "date-fns";

  let { data }: { data: PageData } = $props();

  // Search and filter state
  let searchQuery = $state("");
  let selectedProjectId = $state<string | null>(null);
  let selectedPersonId = $state<string | null>(null);
  let statusFilter = $state<string | null>(null); // 'not_started' | 'in_progress' | 'waiting' | 'completed' | null
  let showCompleted = $state(false); // By default, hide completed tasks

  // Computed filtered tasks
  let filteredTasks = $derived.by(() => {
    let tasks = data.tasks;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.project?.name.toLowerCase().includes(query) ||
          task.accountablePerson?.displayName.toLowerCase().includes(query) ||
          task.executorPerson?.displayName.toLowerCase().includes(query) ||
          task.stakeholders.some((s) =>
            s.person.displayName.toLowerCase().includes(query)
          )
      );
    }

    // Filter by project
    if (selectedProjectId) {
      tasks = tasks.filter((task) => task.projectId === selectedProjectId);
    }

    // Filter by person (accountable, executor, or stakeholder)
    if (selectedPersonId) {
      tasks = tasks.filter(
        (task) =>
          task.accountablePersonId === selectedPersonId ||
          task.executorPersonId === selectedPersonId ||
          task.stakeholders.some((s) => s.personId === selectedPersonId)
      );
    }

    // Filter by status (status filter takes precedence)
    if (statusFilter) {
      tasks = tasks.filter((task) => task.status === statusFilter);
    } else {
      // If no status filter is selected, filter out completed tasks by default
      // (unless showCompleted is true)
      if (!showCompleted) {
        tasks = tasks.filter((task) => task.status !== "completed");
      }
    }

    return tasks;
  });

  // Group tasks by status
  let groupedTasks = $derived.by(() => {
    const groups = {
      not_started: filteredTasks.filter((t) => t.status === "not_started"),
      in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
      waiting: filteredTasks.filter((t) => t.status === "waiting"),
      completed: filteredTasks.filter((t) => t.status === "completed"),
    };
    return groups;
  });

  function clearFilters() {
    searchQuery = "";
    selectedProjectId = null;
    selectedPersonId = null;
    statusFilter = null;
    showCompleted = false; // Reset to default (hide completed)
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

  function formatDate(date: Date | null): string {
    if (!date) return "No due date";
    return format(new Date(date), "MMM d, yyyy");
  }

  function isOverdue(task: any): boolean {
    if (!task.dueAt || task.status === "completed") return false;
    return new Date(task.dueAt) < new Date();
  }

  function getPriorityColor(priority: string | null): string {
    if (!priority) return "bg-gray-100 text-gray-600";
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "not_started":
        return "bg-gray-100 text-gray-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case "not_started":
        return "Not Started";
      case "in_progress":
        return "In Progress";
      case "waiting":
        return "Waiting";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Task Dashboard</h1>
          <p class="text-gray-600 mt-2">
            Search and filter all your tasks across projects and people
          </p>
        </div>
        <div class="flex gap-3">
          <a
            href="/projects"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>📁</span>
            <span>Projects</span>
          </a>
          <a
            href="/people"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>👥</span>
            <span>People</span>
          </a>
          <a
            href="/completed"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
          >
            <span>✅</span>
            <span>Completed</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-600">Total</div>
        <div class="text-2xl font-bold text-gray-900">{data.stats.total}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-600">Not Started</div>
        <div class="text-2xl font-bold text-gray-700">
          {data.stats.notStarted}
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-600">In Progress</div>
        <div class="text-2xl font-bold text-blue-700">
          {data.stats.inProgress}
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-600">Waiting</div>
        <div class="text-2xl font-bold text-yellow-700">
          {data.stats.waiting}
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-600">Completed</div>
        <div class="text-2xl font-bold text-green-700">
          {data.stats.completed}
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Filters</h2>
        <button
          onclick={clearFilters}
          class="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Clear all
        </button>
      </div>

      <!-- Show Completed Toggle -->
      <div class="mb-4 pb-4 border-b border-gray-200">
        <label
          class="flex items-center gap-2 {statusFilter
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer'}"
        >
          <input
            type="checkbox"
            bind:checked={showCompleted}
            disabled={!!statusFilter}
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span class="text-sm font-medium text-gray-700">
            Show completed tasks
          </span>
        </label>
        <p class="text-xs text-gray-500 mt-1 ml-6">
          {statusFilter
            ? "Status filter is active - this option is disabled"
            : showCompleted
              ? "Showing all tasks including completed ones"
              : "Hiding completed tasks (default)"}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            bind:value={searchQuery}
            placeholder="Search tasks, projects, people..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Project Filter -->
        <div>
          <label
            for="project"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Project
          </label>
          <select
            id="project"
            bind:value={selectedProjectId}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={null}>All Projects</option>
            {#each data.projects as project}
              <option value={project.id}>{project.name}</option>
            {/each}
          </select>
        </div>

        <!-- Person Filter -->
        <div>
          <label
            for="person"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Person
          </label>
          <select
            id="person"
            bind:value={selectedPersonId}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={null}>All People</option>
            {#each data.people as person}
              <option value={person.id}>
                {person.displayName} (@{person.handle})
              </option>
            {/each}
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label
            for="status"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Status
          </label>
          <select
            id="status"
            bind:value={statusFilter}
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={null}>All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <!-- Active Filters Display -->
      {#if searchQuery || selectedProjectId || selectedPersonId || statusFilter}
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex flex-wrap gap-2">
            <span class="text-sm text-gray-600">Active filters:</span>
            {#if searchQuery}
              <span
                class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                Search: "{searchQuery}"
              </span>
            {/if}
            {#if selectedProjectId}
              <span
                class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
              >
                Project: {data.projects.find((p) => p.id === selectedProjectId)
                  ?.name || "Unknown"}
              </span>
            {/if}
            {#if selectedPersonId}
              <span
                class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                Person: {data.people.find((p) => p.id === selectedPersonId)
                  ?.displayName || "Unknown"}
              </span>
            {/if}
            {#if statusFilter}
              <span
                class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
              >
                Status: {getStatusLabel(statusFilter)}
              </span>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Results Count and Quick Actions -->
    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-gray-600">
        Showing <span class="font-semibold text-gray-900">{filteredTasks.length}</span> of{" "}
        <span class="font-semibold text-gray-900">{data.tasks.length}</span> tasks
      </p>
      <div class="flex gap-2">
        <a
          href="/inbox"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + New Task
        </a>
      </div>
    </div>

    <!-- Tasks Grid -->
    {#if filteredTasks.length === 0}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p class="text-gray-500 text-lg">No tasks found matching your filters.</p>
        <button
          onclick={clearFilters}
          class="mt-4 text-blue-600 hover:text-blue-700 underline"
        >
          Clear filters
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each filteredTasks as task}
          <div
            class="bg-white rounded-lg shadow-sm border {isOverdue(task)
              ? 'border-red-300'
              : 'border-gray-200'} p-5 hover:shadow-md transition-shadow"
          >
            <!-- Task Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 mb-1">
                  <a
                    href="/tasks/{task.id}"
                    class="hover:text-blue-600 transition-colors"
                  >
                    {task.title}
                  </a>
                </h3>
                {#if task.project}
                  <div class="text-sm text-purple-600 mb-1">
                    📁 {task.project.name}
                  </div>
                {/if}
              </div>
              <div class="flex flex-col items-end gap-1">
                <span
                  class="px-2 py-1 text-xs font-medium rounded {getStatusColor(
                    task.status
                  )}"
                >
                  {getStatusLabel(task.status)}
                </span>
                {#if task.priority}
                  <span
                    class="px-2 py-1 text-xs font-medium rounded {getPriorityColor(
                      task.priority
                    )}"
                  >
                    {task.priority}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Description -->
            {#if task.description}
              <p class="text-sm text-gray-600 mb-3 line-clamp-3">
                {task.description}
              </p>
            {/if}

            <!-- Due Date -->
            <div
              class="text-sm mb-3 {isOverdue(task)
                ? 'text-red-600 font-medium'
                : 'text-gray-500'}"
            >
              📅 {formatDate(task.dueAt)}
              {#if isOverdue(task)}
                <span class="ml-2 text-xs">(Overdue)</span>
              {/if}
            </div>

            <!-- People -->
            <div class="space-y-2 mb-4">
              {#if task.accountablePerson}
                <div class="text-xs text-gray-600">
                  <span class="font-medium">Accountable:</span>{" "}
                  {task.accountablePerson.displayName}
                </div>
              {/if}
              {#if task.executorPerson}
                <div class="text-xs text-gray-600">
                  <span class="font-medium">Executor:</span>{" "}
                  {task.executorPerson.displayName}
                </div>
              {/if}
              {#if task.stakeholders.length > 0}
                <div class="text-xs text-gray-600">
                  <span class="font-medium">Stakeholders:</span>{" "}
                  {task.stakeholders.map((s) => s.person.displayName).join(", ")}
                </div>
              {/if}
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
              <a
                href="/tasks/{task.id}"
                class="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
              >
                View Details →
              </a>
              {#if task.status !== "completed"}
                <button
                  onclick={() => completeTask(task.id)}
                  class="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  ✓ Complete
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

