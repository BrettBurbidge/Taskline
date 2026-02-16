<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";

  let { data, form } = $props();

  let showCreateForm = $state(false);
  let confirmDeleteId: string | null = $state(null);
  let newKeyVisible = $state(form?.newKey ?? null);

  // When form result comes back with a new key, show it
  $effect(() => {
    if (form?.newKey) {
      newKeyVisible = form.newKey;
      showCreateForm = false;
    }
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<div class="max-w-4xl mx-auto py-8 px-4">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

  <!-- API Keys Section -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">API Keys</h2>
        <p class="text-sm text-gray-500 mt-1">
          Manage API keys for external integrations. Include the key as an
          <code class="bg-gray-100 px-1 py-0.5 rounded text-xs">X-API-Key</code> header.
        </p>
      </div>
      <button
        onclick={() => { showCreateForm = !showCreateForm; newKeyVisible = null; }}
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
      >
        Generate New Key
      </button>
    </div>

    <!-- New key creation form -->
    {#if showCreateForm}
      <div class="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
        <form
          method="POST"
          action="?/create"
          use:enhance={() => {
            return async ({ update }) => {
              await update();
              await invalidateAll();
            };
          }}
        >
          <div class="flex gap-3 items-end">
            <div class="flex-1">
              <label for="key-name" class="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
              <input
                id="key-name"
                type="text"
                name="name"
                placeholder="e.g. n8n integration"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              Create
            </button>
            <button
              type="button"
              onclick={() => showCreateForm = false}
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    {/if}

    <!-- Newly created key (shown once) -->
    {#if newKeyVisible}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p class="text-sm font-medium text-green-800 mb-2">
          New API key created! Copy it now — it won't be shown in full again.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 bg-white px-3 py-2 rounded border border-green-300 text-sm font-mono break-all">
            {newKeyVisible}
          </code>
          <button
            onclick={() => copyToClipboard(newKeyVisible!)}
            class="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Copy
          </button>
        </div>
      </div>
    {/if}

    <!-- Keys table -->
    {#if data.apiKeys.length === 0}
      <div class="text-center py-8 text-gray-500">
        <p class="text-lg mb-1">No API keys yet</p>
        <p class="text-sm">Generate a key to start using the external API.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 px-3 font-medium text-gray-600">Name</th>
              <th class="text-left py-2 px-3 font-medium text-gray-600">Key</th>
              <th class="text-left py-2 px-3 font-medium text-gray-600">Created</th>
              <th class="text-left py-2 px-3 font-medium text-gray-600">Last Used</th>
              <th class="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.apiKeys as apiKey}
              <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-3 font-medium text-gray-900">{apiKey.name}</td>
                <td class="py-2 px-3">
                  <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{apiKey.keyPrefix}</code>
                </td>
                <td class="py-2 px-3 text-gray-600">{formatDate(apiKey.createdAt)}</td>
                <td class="py-2 px-3 text-gray-600">
                  {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
                </td>
                <td class="py-2 px-3 text-right">
                  {#if confirmDeleteId === apiKey.id}
                    <form
                      method="POST"
                      action="?/delete"
                      class="inline-flex gap-1"
                      use:enhance={() => {
                        return async ({ update }) => {
                          confirmDeleteId = null;
                          await update();
                          await invalidateAll();
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={apiKey.id} />
                      <button
                        type="submit"
                        class="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onclick={() => confirmDeleteId = null}
                        class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </form>
                  {:else}
                    <button
                      onclick={() => confirmDeleteId = apiKey.id}
                      class="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition-colors"
                    >
                      Revoke
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
