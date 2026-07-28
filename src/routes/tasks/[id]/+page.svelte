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
  let selectedStakeholders = $state<string[]>(
    data.task.stakeholders.map((s) => s.personId)
  );
  // Handles typed in that don't exist yet — created by the update action on save
  let newStakeholderHandles = $state<string[]>([]);
  let stakeholderQuery = $state("");
  let showStakeholderMenu = $state(false);
  let stakeholderHighlight = $state(0);
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
  let showTimeline = $state(false);
  let showFollowUpNoteModal = $state(false);
  let currentFollowUpId = $state<string | null>(null);
  let followUpNote = $state("");
  let showAddFollowUpModal = $state(false);
  let newFollowUpType = $state("self_accountability");
  let newFollowUpTargetPersonId = $state("");
  let newFollowUpDueDate = $state("");
  let completeImmediately = $state(false);
  let newFollowUpNote = $state("");

  // Email Draft Modal state
  let showEmailDraftModal = $state(false);
  let emailSubject = $state("");
  let emailBody = $state("");
  let emailLoading = $state(false);
  let rewriteInstruction = $state("");
  let rewriteLoading = $state(false);
  let postingAsFollowUp = $state(false);
  let copySuccess = $state(false);

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
    selectedStakeholders = data.task.stakeholders.map((s) => s.personId);
    newStakeholderHandles = [];
    stakeholderQuery = "";
  });

  // --- Stakeholder type-ahead -------------------------------------------------

  // Raw text for searching — keeps spaces so display names still match
  let stakeholderSearch = $derived(
    stakeholderQuery.trim().toLowerCase().replace(/^@/, "")
  );

  // Normalize whatever was typed into a valid handle (matches @mention rules)
  let typedHandle = $derived(
    stakeholderSearch.replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "")
  );

  // Existing people not already selected, filtered by the query
  let stakeholderMatches = $derived(
    data.people
      .filter(
        (p) =>
          p.id !== data.task.accountablePersonId &&
          !selectedStakeholders.includes(p.id)
      )
      .filter(
        (p) =>
          !stakeholderSearch ||
          (typedHandle !== "" && p.handle.toLowerCase().includes(typedHandle)) ||
          p.displayName.toLowerCase().includes(stakeholderSearch)
      )
      .slice(0, 8)
  );

  // Only offer creation when the handle is genuinely new
  let canCreateStakeholder = $derived(
    typedHandle.length > 0 &&
      !data.people.some((p) => p.handle.toLowerCase() === typedHandle) &&
      !newStakeholderHandles.includes(typedHandle)
  );

  let stakeholderOptionCount = $derived(
    stakeholderMatches.length + (canCreateStakeholder ? 1 : 0)
  );

  function selectStakeholder(personId: string) {
    if (!selectedStakeholders.includes(personId)) {
      selectedStakeholders = [...selectedStakeholders, personId];
    }
    resetStakeholderQuery();
  }

  function createStakeholder() {
    if (!canCreateStakeholder) return;
    newStakeholderHandles = [...newStakeholderHandles, typedHandle];
    resetStakeholderQuery();
  }

  function removeStakeholder(personId: string) {
    selectedStakeholders = selectedStakeholders.filter((id) => id !== personId);
  }

  function removeNewStakeholder(handle: string) {
    newStakeholderHandles = newStakeholderHandles.filter((h) => h !== handle);
  }

  function resetStakeholderQuery() {
    stakeholderQuery = "";
    stakeholderHighlight = 0;
    showStakeholderMenu = true;
  }

  function chooseHighlightedStakeholder() {
    if (stakeholderHighlight < stakeholderMatches.length) {
      selectStakeholder(stakeholderMatches[stakeholderHighlight].id);
    } else if (canCreateStakeholder) {
      createStakeholder();
    }
  }

  function handleStakeholderKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      showStakeholderMenu = true;
      if (stakeholderOptionCount > 0) {
        stakeholderHighlight =
          (stakeholderHighlight + 1) % stakeholderOptionCount;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (stakeholderOptionCount > 0) {
        stakeholderHighlight =
          (stakeholderHighlight - 1 + stakeholderOptionCount) %
          stakeholderOptionCount;
      }
    } else if (e.key === "Enter") {
      // Never let the type-ahead submit the surrounding edit form
      e.preventDefault();
      chooseHighlightedStakeholder();
    } else if (e.key === "Escape") {
      showStakeholderMenu = false;
    } else if (e.key === "Backspace" && stakeholderQuery === "") {
      // Backspace on an empty input removes the last chip
      if (newStakeholderHandles.length > 0) {
        newStakeholderHandles = newStakeholderHandles.slice(0, -1);
      } else if (selectedStakeholders.length > 0) {
        selectedStakeholders = selectedStakeholders.slice(0, -1);
      }
    }
  }

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

  function promptFollowUpNote(followUpId: string) {
    currentFollowUpId = followUpId;
    followUpNote = "";
    showFollowUpNoteModal = true;
  }

  async function completeFollowUp() {
    if (!currentFollowUpId) return;

    try {
      await fetch(`/api/followups/${currentFollowUpId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: followUpNote.trim() || null }),
      });
      showFollowUpNoteModal = false;
      currentFollowUpId = null;
      followUpNote = "";
      await invalidateAll();
    } catch (err) {
      console.error("Failed to complete follow-up:", err);
    }
  }

  function skipFollowUpNote() {
    if (!currentFollowUpId) return;

    fetch(`/api/followups/${currentFollowUpId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    })
      .then(() => {
        showFollowUpNoteModal = false;
        currentFollowUpId = null;
        followUpNote = "";
        invalidateAll();
      })
      .catch((err) => {
        console.error("Failed to complete follow-up:", err);
      });
  }

  async function createFollowUp() {
    try {
      // Create the follow-up
      const response = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: data.task.id,
          followUpType: newFollowUpType,
          targetPersonId: newFollowUpTargetPersonId || null,
          dueAt: newFollowUpDueDate,
        }),
      });

      const followUp = await response.json();

      // If "complete immediately" is checked, complete it right away
      if (completeImmediately) {
        await fetch(`/api/followups/${followUp.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: newFollowUpNote.trim() || null }),
        });
      }

      showAddFollowUpModal = false;
      completeImmediately = false;
      newFollowUpNote = "";
      await invalidateAll();
    } catch (err) {
      console.error("Failed to create follow-up:", err);
      alert("Failed to create follow-up");
    }
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

  async function deleteFollowUp(followUpId: string) {
    if (!confirm("Are you sure you want to delete this follow-up?")) {
      return;
    }

    try {
      await fetch(`/api/followups/${followUpId}`, {
        method: "DELETE",
      });
      await invalidateAll();
    } catch (err) {
      console.error("Failed to delete follow-up:", err);
      alert("Failed to delete follow-up");
    }
  }

  function exportTimeline() {
    // Build timeline events
    const events = [
      {
        timestamp: data.task.createdAt,
        type: "Task Created",
        description: `Created by @${data.task.accountablePerson.handle}${data.task.project ? ` in #${data.task.project.name}` : ""}`,
      },
      ...(data.task.activities || []).map((activity: any) => ({
        timestamp: activity.createdAt,
        type: activity.activityType
          .split("_")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        description: activity.description,
        note: activity.note,
      })),
    ];

    if (data.task.status === "completed" && data.task.completedAt) {
      events.push({
        timestamp: data.task.completedAt,
        type: "Task Completed",
        description: "Task successfully completed!",
      });
    }

    // Sort by timestamp
    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Build markdown
    let markdown = `# Task Story: ${data.task.title}\n\n`;
    markdown += `**Project:** ${data.task.project?.name || "None"}\n`;
    markdown += `**Accountable:** @${data.task.accountablePerson.handle}\n`;
    if (data.task.executorPerson) {
      markdown += `**Executor:** @${data.task.executorPerson.handle}\n`;
    }
    markdown += `**Status:** ${data.task.status}\n`;
    if (data.task.dueAt) {
      markdown += `**Due:** ${formatDateInUserTZ(data.task.dueAt, "MMM d, yyyy")}\n`;
    }
    markdown += `\n---\n\n## Timeline\n\n`;

    events.forEach((event: any) => {
      const formattedDate = formatDateTimeInUserTZ(
        event.timestamp,
        "MMM d, yyyy 'at' h:mm a"
      );
      markdown += `### ${event.type}\n`;
      markdown += `*${formattedDate}*\n\n`;
      markdown += `${event.description}\n`;
      if (event.note) {
        markdown += `\n> **Note:** ${event.note}\n`;
      }
      markdown += `\n`;
    });

    // Download as file
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-story-${data.task.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function openEmailDraftModal() {
    showEmailDraftModal = true;
    emailLoading = true;
    emailSubject = "";
    emailBody = "";
    rewriteInstruction = "";

    try {
      const res = await fetch("/api/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: data.task.id }),
      });
      const draft = await res.json();
      if (draft.error) throw new Error(draft.error);
      emailSubject = draft.subject;
      emailBody = draft.body;
    } catch (err) {
      console.error("Failed to draft email:", err);
      emailSubject = `Update: ${data.task.title}`;
      emailBody = "(AI draft failed - please write your email here)";
    } finally {
      emailLoading = false;
    }
  }

  async function rewriteEmail() {
    if (!rewriteInstruction.trim()) return;
    rewriteLoading = true;
    try {
      const res = await fetch("/api/ai/rewrite-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          instruction: rewriteInstruction.trim(),
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      emailSubject = result.subject;
      emailBody = result.body;
      rewriteInstruction = "";
    } catch (err) {
      console.error("Rewrite failed:", err);
    } finally {
      rewriteLoading = false;
    }
  }

  async function copyEmailToClipboard() {
    const text = `Subject: ${emailSubject}\n\n${emailBody}`;
    await navigator.clipboard.writeText(text);
    copySuccess = true;
    setTimeout(() => (copySuccess = false), 2000);
  }

  async function postEmailAsFollowUp() {
    postingAsFollowUp = true;
    try {
      const today = new Date().toISOString().split("T")[0];
      const createRes = await fetch("/api/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: data.task.id,
          followUpType: "self_accountability",
          targetPersonId: null,
          dueAt: today,
        }),
      });
      const followUp = await createRes.json();

      const notes = `[Email Draft] Subject: ${emailSubject}\n\n${emailBody}`;
      await fetch(`/api/followups/${followUp.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      showEmailDraftModal = false;
      await invalidateAll();
    } catch (err) {
      console.error("Failed to post as follow-up:", err);
      alert("Failed to post email draft as follow-up");
    } finally {
      postingAsFollowUp = false;
    }
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
          <button
            onclick={() => (showTimeline = !showTimeline)}
            class="px-4 py-2 {showTimeline
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700'} rounded-lg hover:bg-purple-700 hover:text-white transition-colors"
          >
            {showTimeline ? "📝 Details" : "📖 Timeline"}
          </button>
          <button
            onclick={openEmailDraftModal}
            class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            Draft Email
          </button>
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

      <!-- Follow-up Note Modal -->
      {#if showFollowUpNoteModal}
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onclick={(e) => {
            if (e.target === e.currentTarget) {
              showFollowUpNoteModal = false;
            }
          }}
        >
          <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">
              📝 Follow-up Complete
            </h2>
            <p class="text-sm text-gray-600 mb-4">
              Add a quick note about what happened (optional but recommended for
              building your task story):
            </p>
            <textarea
              bind:value={followUpNote}
              placeholder="e.g., 'Made progress on implementation, will check in again tomorrow' or 'Blocked waiting for client response'"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="4"
              autofocus
            ></textarea>
            <div class="flex gap-2 mt-4">
              <button
                onclick={completeFollowUp}
                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {followUpNote.trim() ? "Save & Complete" : "Complete"}
              </button>
              <button
                onclick={skipFollowUpNote}
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Skip Note
              </button>
              <button
                onclick={() => (showFollowUpNoteModal = false)}
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Add Follow Up Modal -->
      {#if showAddFollowUpModal}
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onclick={(e) => {
            if (e.target === e.currentTarget) {
              showAddFollowUpModal = false;
            }
          }}
        >
          <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 class="text-xl font-bold text-gray-900 mb-4">
              ➕ Add Follow Up
            </h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  bind:value={newFollowUpType}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="self_accountability"
                    >Self Accountability</option
                  >
                  <option value="executor_checkin">Executor Check-in</option>
                  <option value="stakeholder_update">Stakeholder Update</option>
                </select>
              </div>

              {#if newFollowUpType !== "self_accountability"}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Target Person
                  </label>
                  <select
                    bind:value={newFollowUpTargetPersonId}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select person...</option>
                    {#each data.people as person}
                      <option value={person.id}>{person.displayName}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  bind:value={newFollowUpDueDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <!-- Complete immediately option -->
              <div class="border-t border-gray-200 pt-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={completeImmediately}
                    class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span class="text-sm font-medium text-gray-700">
                    Complete immediately with note
                  </span>
                </label>
                <p class="text-xs text-gray-500 mt-1 ml-6">
                  Check this to create and complete the follow-up in one step
                </p>
              </div>

              {#if completeImmediately}
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Note (optional)
                  </label>
                  <textarea
                    bind:value={newFollowUpNote}
                    placeholder="e.g., 'Called and left voicemail' or 'Sent email with update'"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="3"
                  ></textarea>
                </div>
              {/if}
            </div>

            <div class="flex gap-2 mt-6">
              <button
                onclick={createFollowUp}
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                disabled={newFollowUpType !== "self_accountability" &&
                  !newFollowUpTargetPersonId}
              >
                {completeImmediately ? "Create & Complete" : "Create Follow Up"}
              </button>
              <button
                onclick={() => (showAddFollowUpModal = false)}
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Email Draft Modal -->
      {#if showEmailDraftModal}
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onclick={(e) => {
            if (e.target === e.currentTarget) showEmailDraftModal = false;
          }}
        >
          <div
            class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 class="text-xl font-bold text-gray-900 mb-4">
              Draft Email
            </h2>

            {#if emailLoading}
              <div class="flex items-center justify-center py-12">
                <div class="text-gray-500">Generating draft...</div>
              </div>
            {:else}
              <!-- Subject -->
              <div class="mb-4">
                <label
                  class="block text-sm font-medium text-gray-700 mb-1"
                >
                  Subject
                </label>
                <input
                  type="text"
                  bind:value={emailSubject}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <!-- Body -->
              <div class="mb-4">
                <label
                  class="block text-sm font-medium text-gray-700 mb-1"
                >
                  Body
                </label>
                <textarea
                  bind:value={emailBody}
                  rows="10"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y font-mono text-sm"
                ></textarea>
              </div>

              <!-- AI Rewrite -->
              <div class="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >AI Rewrite</label
                >
                <div class="flex gap-2">
                  <input
                    type="text"
                    bind:value={rewriteInstruction}
                    placeholder="e.g. 'make it more formal' or 'shorten to 2 sentences'"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    onkeydown={(e) => {
                      if (e.key === "Enter") rewriteEmail();
                    }}
                  />
                  <button
                    onclick={rewriteEmail}
                    disabled={rewriteLoading || !rewriteInstruction.trim()}
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  >
                    {rewriteLoading ? "Rewriting..." : "Rewrite"}
                  </button>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex gap-2 flex-wrap">
                <button
                  onclick={copyEmailToClipboard}
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  {copySuccess ? "Copied!" : "Copy to Clipboard"}
                </button>
                <button
                  onclick={postEmailAsFollowUp}
                  disabled={postingAsFollowUp}
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors text-sm"
                >
                  {postingAsFollowUp
                    ? "Posting..."
                    : "Post as Follow-up"}
                </button>
                <button
                  onclick={() => (showEmailDraftModal = false)}
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm ml-auto"
                >
                  Close
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
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

                <div>
                  <div class="block text-sm font-medium text-gray-700 mb-2">
                    Stakeholders
                  </div>
                  {#if selectedStakeholders.length > 0 || newStakeholderHandles.length > 0}
                    <div class="flex flex-wrap gap-2 mb-2">
                      {#each selectedStakeholders as personId}
                        {@const person = data.people.find(
                          (p) => p.id === personId
                        )}
                        {#if person}
                          <span
                            class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-sm border bg-blue-100 border-blue-300 text-blue-700"
                          >
                            {person.displayName}
                            <button
                              type="button"
                              onclick={() => removeStakeholder(personId)}
                              aria-label="Remove {person.displayName}"
                              class="w-4 h-4 flex items-center justify-center rounded-full hover:bg-blue-200 text-blue-500 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        {/if}
                      {/each}
                      {#each newStakeholderHandles as handle}
                        <span
                          title="Will be created when you save"
                          class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-sm border border-dashed bg-green-50 border-green-400 text-green-800"
                        >
                          @{handle}
                          <span class="text-xs text-green-600">new</span>
                          <button
                            type="button"
                            onclick={() => removeNewStakeholder(handle)}
                            aria-label="Remove @{handle}"
                            class="w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-200 text-green-600 hover:text-green-900"
                          >
                            ×
                          </button>
                        </span>
                      {/each}
                    </div>
                  {/if}

                  <div class="relative">
                    <input
                      type="text"
                      bind:value={stakeholderQuery}
                      oninput={() => {
                        stakeholderHighlight = 0;
                        showStakeholderMenu = true;
                      }}
                      onfocus={() => (showStakeholderMenu = true)}
                      onblur={() => (showStakeholderMenu = false)}
                      onkeydown={handleStakeholderKeydown}
                      placeholder="Add a stakeholder — type a name or @handle"
                      autocomplete="off"
                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    {#if showStakeholderMenu && stakeholderOptionCount > 0}
                      <div
                        class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                      >
                        {#each stakeholderMatches as person, i}
                          <button
                            type="button"
                            onmousedown={(e) => e.preventDefault()}
                            onclick={() => selectStakeholder(person.id)}
                            class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm {i ===
                            stakeholderHighlight
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-50'}"
                          >
                            <span class="text-gray-900">
                              {person.displayName}
                            </span>
                            <span class="text-gray-500">@{person.handle}</span>
                          </button>
                        {/each}

                        {#if canCreateStakeholder}
                          <button
                            type="button"
                            onmousedown={(e) => e.preventDefault()}
                            onclick={createStakeholder}
                            class="w-full px-4 py-2 text-left text-sm border-t border-gray-200 {stakeholderHighlight ===
                            stakeholderMatches.length
                              ? 'bg-green-50'
                              : 'hover:bg-gray-50'}"
                          >
                            <span class="text-green-700 font-medium">
                              + Create new person
                            </span>
                            <span class="text-gray-600">"@{typedHandle}"</span>
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </div>

                  <input
                    type="hidden"
                    name="stakeholderPersonIds"
                    value={selectedStakeholders.join(",")}
                  />
                  <input
                    type="hidden"
                    name="newStakeholderHandles"
                    value={newStakeholderHandles.join(",")}
                  />
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
              onclick={() => {
                showAddFollowUpModal = true;
                newFollowUpType = "self_accountability";
                newFollowUpTargetPersonId = "";
                completeImmediately = false;
                newFollowUpNote = "";
                // Default to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                newFollowUpDueDate = tomorrow.toISOString().split("T")[0];
              }}
              class="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Follow Up
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
                          onclick={() => promptFollowUpNote(followUp.id)}
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
                          onclick={() => deleteFollowUp(followUp.id)}
                          class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          title="Delete follow-up"
                        >
                          Delete
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

    <!-- Timeline View -->
    {#if showTimeline}
      <div class="bg-white rounded-lg shadow p-6 mt-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-900">📖 Task Story</h2>
          <button
            onclick={exportTimeline}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            📄 Export Timeline
          </button>
        </div>

        <div class="space-y-4">
          <!-- Task Created -->
          <div class="flex gap-4">
            <div
              class="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"
            >
              <span class="text-xl">🎯</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-gray-900">Task Created</span>
                <span class="text-xs text-gray-500">
                  {formatDateTimeInUserTZ(
                    data.task.createdAt,
                    "MMM d, yyyy 'at' h:mm a"
                  )}
                </span>
              </div>
              <p class="text-sm text-gray-600">
                Created by @{data.task.accountablePerson.handle}
                {#if data.task.project}
                  in #{data.task.project.name}
                {/if}
              </p>
            </div>
          </div>

          <!-- Activities (sorted chronologically) -->
          {#each (data.task.activities || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) as timelineEvent}
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"
              >
                <span class="text-xl">
                  {#if timelineEvent.activityType === "followup_completed"}
                    ✅
                  {:else if timelineEvent.activityType === "status_changed"}
                    🔄
                  {:else if timelineEvent.activityType === "completed"}
                    🎉
                  {:else}
                    📝
                  {/if}
                </span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-gray-900">
                    {timelineEvent.activityType
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </span>
                  <span class="text-xs text-gray-500">
                    {formatDateTimeInUserTZ(
                      timelineEvent.createdAt,
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </span>
                </div>
                <p class="text-sm text-gray-700">
                  {timelineEvent.description}
                </p>
                {#if timelineEvent.note}
                  <div
                    class="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded"
                  >
                    <p class="text-sm text-gray-700 italic">
                      "{timelineEvent.note}"
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/each}

          <!-- Task Completed (if completed) -->
          {#if data.task.status === "completed" && data.task.completedAt}
            <div class="flex gap-4">
              <div
                class="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
              >
                <span class="text-xl">🎉</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-semibold text-gray-900">Task Completed</span
                  >
                  <span class="text-xs text-gray-500">
                    {formatDateTimeInUserTZ(
                      data.task.completedAt,
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </span>
                </div>
                <p class="text-sm text-gray-600">
                  Task successfully completed!
                </p>
              </div>
            </div>
          {/if}

          {#if (data.task.activities?.length || 0) === 0}
            <div class="text-center py-8 text-gray-500">
              <p class="text-sm">
                No activity yet. Complete follow-ups to build your task story!
              </p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
