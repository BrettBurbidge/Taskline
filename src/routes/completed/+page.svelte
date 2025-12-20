<script lang="ts">
  import { formatDateInUserTZ } from "$lib/utils/timezone";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let selectedProject = $state<string | null>(null);
  let selectedPerson = $state<string | null>(null);

  // Filter tasks based on selected filters
  function filterTasks(tasks: any[]) {
    return tasks.filter((task) => {
      if (selectedProject && task.projectId !== selectedProject) return false;
      if (
        selectedPerson &&
        task.executorPersonId !== selectedPerson &&
        task.accountablePersonId !== selectedPerson
      )
        return false;
      return true;
    });
  }

  const filteredGroups = $derived({
    today: filterTasks(data.groupedTasks.today),
    yesterday: filterTasks(data.groupedTasks.yesterday),
    thisWeek: filterTasks(data.groupedTasks.thisWeek),
    thisMonth: filterTasks(data.groupedTasks.thisMonth),
    older: filterTasks(data.groupedTasks.older),
  });
</script>

<div class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">✅ Completed</h1>
      <p class="text-gray-600">
        Your accomplishments, task history, and closed projects
      </p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-2xl font-bold text-green-600">
          {data.stats.today}
        </div>
        <div class="text-sm text-gray-600">Today</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-2xl font-bold text-blue-600">
          {data.stats.thisWeek}
        </div>
        <div class="text-sm text-gray-600">This Week</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-2xl font-bold text-purple-600">
          {data.stats.thisMonth}
        </div>
        <div class="text-sm text-gray-600">This Month</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <div class="text-2xl font-bold text-gray-600">
          {data.stats.total}
        </div>
        <div class="text-sm text-gray-600">All Time</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Filter by Project
          </label>
          <select
            bind:value={selectedProject}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={null}>All Projects</option>
            {#each data.projects as project}
              <option value={project.id}>{project.name}</option>
            {/each}
          </select>
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Filter by Person
          </label>
          <select
            bind:value={selectedPerson}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={null}>All People</option>
            {#each data.people as person}
              <option value={person.id}>{person.displayName}</option>
            {/each}
          </select>
        </div>
        {#if selectedProject || selectedPerson}
          <div class="flex items-end">
            <button
              onclick={() => {
                selectedProject = null;
                selectedPerson = null;
              }}
              class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Closed Projects -->
    {#if data.closedProjects.length > 0}
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">📦 Closed Projects</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each data.closedProjects as project}
            <a
              href="/projects/{project.id}"
              class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow border-l-4 border-gray-400"
            >
              <div class="flex items-start justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-900">
                  {project.name}
                </h3>
                <span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                  Closed
                </span>
              </div>
              
              {#if project.description}
                <p class="text-sm text-gray-600 mb-3 line-clamp-2">
                  {project.description}
                </p>
              {/if}
              
              <div class="flex items-center justify-between text-sm">
                <div class="text-gray-500">
                  {project._count.tasks} task{project._count.tasks !== 1 ? 's' : ''}
                </div>
                <div class="text-gray-400 text-xs">
                  Closed {formatDateInUserTZ(project.updatedAt, 'MMM d, yyyy')}
                </div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Task Groups -->
    <div class="space-y-6">
      {#if filteredGroups.today.length > 0}
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-3">Today</h2>
          <div class="space-y-2">
            {#each filteredGroups.today as task}
              <a
                href="/tasks/{task.id}"
                class="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{task.title}</h3>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                      {#if task.project}
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          #{task.project.name}
                        </span>
                      {/if}
                      {#if task.executorPerson}
                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          @{task.executorPerson.handle}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 ml-4">
                    {formatDateInUserTZ(task.completedAt, "h:mm a")}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if filteredGroups.yesterday.length > 0}
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-3">Yesterday</h2>
          <div class="space-y-2">
            {#each filteredGroups.yesterday as task}
              <a
                href="/tasks/{task.id}"
                class="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{task.title}</h3>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                      {#if task.project}
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          #{task.project.name}
                        </span>
                      {/if}
                      {#if task.executorPerson}
                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          @{task.executorPerson.handle}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 ml-4">
                    {formatDateInUserTZ(task.completedAt, "h:mm a")}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if filteredGroups.thisWeek.length > 0}
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-3">Earlier This Week</h2>
          <div class="space-y-2">
            {#each filteredGroups.thisWeek as task}
              <a
                href="/tasks/{task.id}"
                class="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{task.title}</h3>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                      {#if task.project}
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          #{task.project.name}
                        </span>
                      {/if}
                      {#if task.executorPerson}
                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          @{task.executorPerson.handle}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 ml-4">
                    {formatDateInUserTZ(task.completedAt, "MMM d")}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if filteredGroups.thisMonth.length > 0}
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-3">Earlier This Month</h2>
          <div class="space-y-2">
            {#each filteredGroups.thisMonth as task}
              <a
                href="/tasks/{task.id}"
                class="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{task.title}</h3>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                      {#if task.project}
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          #{task.project.name}
                        </span>
                      {/if}
                      {#if task.executorPerson}
                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          @{task.executorPerson.handle}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 ml-4">
                    {formatDateInUserTZ(task.completedAt, "MMM d")}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if filteredGroups.older.length > 0}
        <div>
          <h2 class="text-xl font-bold text-gray-900 mb-3">Older</h2>
          <div class="space-y-2">
            {#each filteredGroups.older as task}
              <a
                href="/tasks/{task.id}"
                class="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">{task.title}</h3>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                      {#if task.project}
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          #{task.project.name}
                        </span>
                      {/if}
                      {#if task.executorPerson}
                        <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          @{task.executorPerson.handle}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="text-xs text-gray-500 ml-4">
                    {formatDateInUserTZ(task.completedAt, "MMM d, yyyy")}
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      {#if Object.values(filteredGroups).every((group) => group.length === 0)}
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <div class="text-4xl mb-4">🎯</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            No completed tasks found
          </h3>
          <p class="text-gray-600">
            {#if selectedProject || selectedPerson}
              Try adjusting your filters or complete some tasks!
            {:else}
              Complete some tasks to see them here!
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

