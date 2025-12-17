<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import {
    utcToDateString,
    formatDateInUserTZ,
    formatDateTimeInUserTZ,
    getUserTimezone,
  } from "$lib/utils/timezone";

  let { data }: { data: PageData } = $props();

  const timezone = getUserTimezone();

  let isEditing = $state(false);
  let formData = $state({
    title: data.task.title,
    description: data.task.description || "",
    status: data.task.status,
    dueAt: utcToDateString(data.task.dueAt),
    projectId: data.task.projectId || "",
    priority: data.task.priority || "",
    executorPersonId: data.task.executorPersonId || "",
  });

  let newNote = $state("");
  let showDeleteConfirm = $state(false);

  // Update formData when data changes (after save/reload)
  $effect(() => {
    formData = {
      title: data.task.title,
      description: data.task.description || "",
      status: data.task.status,
      dueAt: utcToDateString(data.task.dueAt),
      projectId: data.task.projectId || "",
      priority: data.task.priority || "",
      executorPersonId: data.task.executorPersonId || "",
    };
  });

  function getStatusColor(status: string) {
    switch (status) {
      case "not_started":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "in_progress":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "waiting":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "completed":
        return "bg-green-100 text-green-700 border-green-300";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  }

  function formatFollowUpType(type: string) {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async function generateFollowUps() {
    await fetch(`/api/tasks/${data.task.id}/followups/generate`, {
      method: "POST",
    });
    await invalidateAll();
  }

  async function completeTask() {
    await fetch(`/api/tasks/${data.task.id}/complete`, {
      method: "POST",
    });
    goto("/board");
  }

  async function completeFollowUp(followUpId: string) {
    await fetch(`/api/followups/${followUpId}/complete`, {
      method: "POST",
    });
    await invalidateAll();
  }

  async function snoozeFollowUp(followUpId: string, days: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);

    await fetch(`/api/followups/${followUpId}/snooze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        until: until.toISOString().split("T")[0],
      }),
    });
    await invalidateAll();
  }
</script>

<div class="py-8">
  <div class="max-w-5xl mx-auto px-4">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center text-sm text-gray-600 mb-3">
        <a href="/board" class="hover:text-gray-900">Board</a>
        <span class="mx-2">›</span>
        <span class="text-gray-900">Task Details</span>
      </div>

      <div class="flex items-start justify-between">
        <h1 class="text-3xl font-bold text-gray-900">
          {isEditing ? "Edit Task" : data.task.title}
        </h1>
        <div class="flex gap-2">
          {#if !isEditing}
            <button
              onclick={() => (isEditing = true)}
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Edit
            </button>
            {#if data.task.status !== "completed"}
              <button
                onclick={completeTask}
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✓ Complete
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Content -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Task Form/Details -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {#if isEditing}
            <form
              method="POST"
              action="?/update"
              use:enhance={() => {
                return async ({ update }) => {
                  await update();
                  isEditing = false;
                  await invalidateAll();
                };
              }}
            >
              <input type="hidden" name="timezone" value={timezone} />
              <div class="space-y-4">
                <div>
                  <label
                    for="title"
                    class="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Title *
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    bind:value={formData.title}
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    for="description"
                    class="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows="4"
                    bind:value={formData.description}
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  ></textarea>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      for="status"
                      class="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      bind:value={formData.status}
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting">Waiting</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label
                      for="dueAt"
                      class="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Due Date
                    </label>
                    <input
                      id="dueAt"
                      name="dueAt"
                      type="date"
                      bind:value={formData.dueAt}
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      for="projectId"
                      class="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Project
                    </label>
                    <select
                      id="projectId"
                      name="projectId"
                      bind:value={formData.projectId}
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No project</option>
                      {#each data.projects as project}
                        <option value={project.id}>{project.name}</option>
                      {/each}
                    </select>
                  </div>

                  <div>
                    <label
                      for="executorPersonId"
                      class="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Executor
                    </label>
                    <select
                      id="executorPersonId"
                      name="executorPersonId"
                      bind:value={formData.executorPersonId}
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {#each data.people as person}
                        <option value={person.id}>
                          {person.displayName} (@{person.handle})
                        </option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onclick={() => (isEditing = false)}
                    class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          {:else}
            <div class="space-y-4">
              <div>
                <div class="text-sm text-gray-600 mb-1">Status</div>
                <span
                  class="inline-block px-3 py-1 rounded-full text-sm font-medium border {getStatusColor(
                    data.task.status
                  )}"
                >
                  {data.task.status.replace("_", " ")}
                </span>
              </div>

              {#if data.task.description}
                <div>
                  <div class="text-sm text-gray-600 mb-1">Description</div>
                  <p class="text-gray-900 whitespace-pre-wrap">
                    {data.task.description}
                  </p>
                </div>
              {/if}

              <div class="grid grid-cols-2 gap-4">
                {#if data.task.dueAt}
                  <div>
                    <div class="text-sm text-gray-600 mb-1">Due Date</div>
                    <div class="text-gray-900">
                      {formatDateInUserTZ(data.task.dueAt, "MMMM d, yyyy")}
                    </div>
                  </div>
                {/if}

                {#if data.task.project}
                  <div>
                    <div class="text-sm text-gray-600 mb-1">Project</div>
                    <a
                      href="/projects/{data.task.project.id}"
                      class="text-blue-600 hover:text-blue-700"
                    >
                      {data.task.project.name}
                    </a>
                  </div>
                {/if}
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-sm text-gray-600 mb-1">Accountable</div>
                  <div class="text-gray-900">
                    {data.task.accountablePerson.displayName}
                    <span class="text-gray-500"
                      >@{data.task.accountablePerson.handle}</span
                    >
                  </div>
                </div>

                {#if data.task.executorPerson}
                  <div>
                    <div class="text-sm text-gray-600 mb-1">Executor</div>
                    <div class="text-gray-900">
                      {data.task.executorPerson.displayName}
                      <span class="text-gray-500"
                        >@{data.task.executorPerson.handle}</span
                      >
                    </div>
                  </div>
                {/if}
              </div>

              {#if data.task.stakeholders.length > 0}
                <div>
                  <div class="text-sm text-gray-600 mb-2">Stakeholders</div>
                  <div class="flex flex-wrap gap-2">
                    {#each data.task.stakeholders as stakeholder}
                      <span class="px-3 py-1 bg-gray-100 rounded-full text-sm">
                        {stakeholder.person.displayName}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Context Notes -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Notes</h2>
          </div>

          <div class="p-4">
            <form
              method="POST"
              action="?/addNote"
              use:enhance={() => {
                return async ({ update }) => {
                  await update();
                  newNote = "";
                  await invalidateAll();
                };
              }}
            >
              <textarea
                name="content"
                bind:value={newNote}
                rows="3"
                placeholder="Add a note..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              ></textarea>
              <button
                type="submit"
                disabled={!newNote.trim()}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Add Note
              </button>
            </form>

            {#if data.task.contextNotes.length > 0}
              <div class="mt-4 space-y-3">
                {#each data.task.contextNotes as note}
                  <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-gray-900 text-sm whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div class="text-xs text-gray-500 mt-2">
                      {formatDateTimeInUserTZ(note.createdAt, "MMM d, h:mm a")}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- Follow-ups -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <div
            class="p-4 border-b border-gray-200 flex items-center justify-between"
          >
            <h2 class="text-lg font-semibold text-gray-900">Follow-ups</h2>
            <button
              onclick={generateFollowUps}
              class="text-sm text-blue-600 hover:text-blue-700"
            >
              Regenerate
            </button>
          </div>

          {#if data.task.followUps.length === 0}
            <div class="p-6 text-center text-gray-500 text-sm">
              No follow-ups yet
            </div>
          {:else}
            <div class="divide-y divide-gray-200">
              {#each data.task.followUps as followUp}
                <div class="p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900 mb-1">
                        {formatFollowUpType(followUp.followUpType)}
                      </div>
                      <div class="text-xs text-gray-600 mb-2">
                        Due: {formatDateInUserTZ(followUp.dueAt, "MMM d, yyyy")}
                        {#if followUp.targetPerson}
                          → @{followUp.targetPerson.handle}
                        {/if}
                      </div>
                      <span
                        class="inline-block px-2 py-0.5 rounded text-xs {followUp.status ===
                        'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'}"
                      >
                        {followUp.status}
                      </span>
                    </div>

                    {#if followUp.status === "pending"}
                      <div class="flex gap-2">
                        <button
                          onclick={() => completeFollowUp(followUp.id)}
                          class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          Done
                        </button>
                        <button
                          onclick={() => snoozeFollowUp(followUp.id, 1)}
                          class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          +1d
                        </button>
                        <button
                          onclick={() => snoozeFollowUp(followUp.id, 3)}
                          class="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          +3d
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Metadata -->
        <div class="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">Metadata</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Created:</span>
              <span class="font-medium text-gray-900">
                {formatDateInUserTZ(data.task.createdAt, "MMM d, yyyy")}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Updated:</span>
              <span class="font-medium text-gray-900">
                {formatDateTimeInUserTZ(data.task.updatedAt, "MMM d, h:mm a")}
              </span>
            </div>
            {#if data.task.completedAt}
              <div class="flex justify-between">
                <span class="text-gray-600">Completed:</span>
                <span class="font-medium text-green-600">
                  {formatDateInUserTZ(data.task.completedAt, "MMM d, yyyy")}
                </span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="bg-red-50 rounded-lg border border-red-200 p-4">
          <h3 class="text-sm font-semibold text-red-900 mb-3">Danger Zone</h3>
          {#if showDeleteConfirm}
            <div class="space-y-3">
              <p class="text-sm text-red-700">
                Are you sure? This cannot be undone.
              </p>
              <div class="flex gap-2">
                <form method="POST" action="?/delete" use:enhance>
                  <button
                    type="submit"
                    class="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                </form>
                <button
                  onclick={() => (showDeleteConfirm = false)}
                  class="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          {:else}
            <button
              onclick={() => (showDeleteConfirm = true)}
              class="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Delete Task
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
