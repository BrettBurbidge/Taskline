<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { parseMentions, parseProjects } from '$lib/utils/mentions';
	import { parseDate, formatParsedDate, formatParsedDateForInput } from '$lib/utils/dateParser';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let description = $state('');
	let dueAt = $state('');
	let projectId = $state('');
	let executorPersonId = $state('');
	let selectedStakeholders = $state<string[]>([]);
	let showDetails = $state(false);
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let aiEnabled = $state(false);
	let checkingAI = $state(true);
	let aiSuggestion = $state<any>(null);
	let loadingSuggestion = $state(false);

	// Check if AI is available on mount (only once)
	let mounted = false;
	$effect(() => {
		if (!mounted) {
			mounted = true;
			checkAIStatus();
		}
	});

	async function checkAIStatus() {
		try {
			const res = await fetch('/api/ai/status');
			const result = await res.json();
			aiEnabled = result.available;
		} catch {
			aiEnabled = false;
		} finally {
			checkingAI = false;
		}
	}

	// Auto-parse mentions using derived state (not effect to avoid infinite loops)
	let parsedMentions = $derived.by(() => {
		const fullText = `${title} ${description}`;
		if (!fullText.trim()) {
			return { stakeholders: [], executor: null };
		}
		return parseMentions(fullText);
	});

	// Auto-parse projects using derived state
	let parsedProjects = $derived.by(() => {
		const fullText = `${title} ${description}`;
		if (!fullText.trim()) {
			return { projects: [] };
		}
		return parseProjects(fullText);
	});

	let newPeople = $derived.by(() => {
		if (!data?.people) return [];
		const existingHandles = data.people.map((p) => p.handle.toLowerCase());
		const allMentionedHandles = [
			...parsedMentions.stakeholders,
			...(parsedMentions.executor ? [parsedMentions.executor] : [])
		];
		return allMentionedHandles.filter((handle) => !existingHandles.includes(handle));
	});

	let newProjects = $derived.by(() => {
		if (!data?.projects) return [];
		const existingProjectNames = new Set(data.projects.map((p) => p.name.toLowerCase()));
		return parsedProjects.projects.filter((name) => !existingProjectNames.has(name.toLowerCase()));
	});

	let showMentionSuggestions = $derived(
		newPeople.length > 0 || 
		parsedMentions.stakeholders.length > 0 || 
		parsedMentions.executor !== null
	);

	let showProjectSuggestions = $derived(
		parsedProjects.projects.length > 0
	);

	// Auto-parse dates using derived state
	let parsedDateResult = $derived.by(() => {
		const fullText = `${title} ${description}`;
		if (!fullText.trim()) {
			return { date: null, matchedText: null, pattern: null };
		}
		return parseDate(fullText);
	});

	let showDateSuggestion = $derived(parsedDateResult.date !== null && !dueAt);

	async function createTask() {
		if (!title.trim()) {
			errorMessage = 'Task title is required';
			return;
		}

		isSubmitting = true;
		errorMessage = '';

		try {
			// Step 1: Create any new people mentioned
			const createdPeople = new Map<string, string>(); // handle -> id
			
			for (const handle of newPeople) {
				try {
					const response = await fetch('/api/people', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							handle: handle.toLowerCase(),
							displayName: handle.charAt(0).toUpperCase() + handle.slice(1), // Capitalize first letter
							source: 'mention'
						})
					});
					
					if (response.ok) {
						const person = await response.json();
						createdPeople.set(handle.toLowerCase(), person.id);
					}
				} catch (err) {
					console.warn(`Failed to create person @${handle}:`, err);
				}
			}

			// Step 1.5: Create or find projects mentioned
			// If # tag is present, it takes precedence over manual selection
			let finalProjectId = projectId || null;
			
			if (parsedProjects.projects.length > 0) {
				// Use the first project mentioned (if multiple, take the first one)
				const projectName = parsedProjects.projects[0];
				
				// Check if it's an existing project (case-insensitive comparison)
				const existingProject = data.projects.find(
					(p) => p.name.toLowerCase() === projectName.toLowerCase()
				);
				
				if (existingProject) {
					// Found existing project - use it
					finalProjectId = existingProject.id;
				} else {
					// Create new project
					// If project name contains spaces or special characters, it was quoted - preserve exact casing
					// Otherwise, normalize unquoted projects to "Capitalized" format
					const hasSpacesOrSpecialChars = /\s|[^a-zA-Z0-9_]/.test(projectName);
					const nameToCreate = hasSpacesOrSpecialChars
						? projectName  // Preserve exact casing for quoted projects
						: projectName.charAt(0).toUpperCase() + projectName.slice(1).toLowerCase(); // Normalize unquoted
					
					try {
						const response = await fetch('/api/projects', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								name: nameToCreate,
								description: null
							})
						});
						
						if (response.ok) {
							const project = await response.json();
							finalProjectId = project.id;
						}
					} catch (err) {
						console.warn(`Failed to create project #${projectName}:`, err);
					}
				}
			}

			// Step 2: Map handles to person IDs
			const stakeholderIds: string[] = [];
			for (const handle of parsedMentions.stakeholders) {
				// Check if newly created
				if (createdPeople.has(handle)) {
					stakeholderIds.push(createdPeople.get(handle)!);
				} else {
					// Find in existing people
					const person = data.people.find((p) => p.handle.toLowerCase() === handle.toLowerCase());
					if (person) {
						stakeholderIds.push(person.id);
					}
				}
			}

			// Step 3: Determine executor
			let finalExecutorId = executorPersonId || data.currentUser!.id;
			
			if (parsedMentions.executor) {
				// Check if newly created
				if (createdPeople.has(parsedMentions.executor)) {
					finalExecutorId = createdPeople.get(parsedMentions.executor)!;
				} else {
					// Find in existing people
					const person = data.people.find((p) => p.handle.toLowerCase() === parsedMentions.executor?.toLowerCase());
					if (person) {
						finalExecutorId = person.id;
					}
				}
			}

			// Step 4: Determine due date (manual or parsed)
			let finalDueAt = dueAt;
			if (!finalDueAt && parsedDateResult.date) {
				finalDueAt = formatParsedDateForInput(parsedDateResult);
			}

			// Step 5: Create the task
			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: title.trim(),
					description: description.trim() || null,
					dueAt: finalDueAt || null,
					projectId: finalProjectId,
					accountablePersonId: data.currentUser!.id,
					executorPersonId: finalExecutorId,
					stakeholderPersonIds: stakeholderIds.length > 0 ? stakeholderIds : selectedStakeholders,
					boardDate: new Date().toISOString().split('T')[0]
				})
			});

			if (!response.ok) {
				throw new Error('Failed to create task');
			}

			// Reset form
			title = '';
			description = '';
			dueAt = '';
			projectId = '';
			executorPersonId = '';
			selectedStakeholders = [];
			showDetails = false;

			// Redirect to board
			goto('/board');
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create task';
		} finally {
			isSubmitting = false;
		}
	}

	function toggleStakeholder(personId: string) {
		if (selectedStakeholders.includes(personId)) {
			selectedStakeholders = selectedStakeholders.filter((id) => id !== personId);
		} else {
			selectedStakeholders = [...selectedStakeholders, personId];
		}
	}

	function applyParsedDate() {
		if (parsedDateResult.date) {
			dueAt = formatParsedDateForInput(parsedDateResult);
		}
	}

	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !showDetails) {
			e.preventDefault();
			createTask();
		}
	}

	async function getAISuggestion() {
		if (!title.trim()) {
			errorMessage = 'Enter a task description to get AI suggestions';
			return;
		}

		loadingSuggestion = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/ai/suggest-task', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					inputText: title + (description ? '\n' + description : ''),
					currentDate: new Date().toISOString()
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get AI suggestion');
			}

			const suggestion = await response.json();
			aiSuggestion = suggestion;

			// Apply suggestions
			if (suggestion.title && suggestion.title !== title) {
				title = suggestion.title;
			}
			if (suggestion.description && !description) {
				description = suggestion.description;
			}
			if (suggestion.dueDate) {
				dueAt = suggestion.dueDate;
			}
			if (suggestion.suggestedProjectId) {
				projectId = suggestion.suggestedProjectId;
			}
			if (suggestion.suggestedStakeholderIds?.length > 0) {
				// Find person IDs from handles
				const peopleIds = suggestion.suggestedStakeholderIds
					.map((handle: string) => data.people.find((p) => p.handle === handle)?.id)
					.filter(Boolean);
				selectedStakeholders = peopleIds;
			}

			showDetails = true;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to get AI suggestion';
		} finally {
			loadingSuggestion = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-4xl mx-auto px-4">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Inbox</h1>
			<p class="text-gray-600 mt-2">Quickly capture tasks and commitments</p>
		</div>

		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			{#if errorMessage}
				<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					{errorMessage}
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Title Input -->
				<div>
					<label for="title" class="block text-sm font-medium text-gray-700 mb-2">
						Task Title *
					</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						onkeypress={handleKeyPress}
						placeholder="What needs to be done?"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>

				<!-- Parsed Date Preview -->
				{#if showDateSuggestion}
					<div class="p-4 bg-green-50 border border-green-200 rounded-lg">
						<div class="flex items-center justify-between">
							<div>
								<div class="text-sm font-medium text-green-900 mb-1">
									📅 Detected date: <span class="font-bold">{parsedDateResult.pattern}</span>
								</div>
								<div class="text-xs text-green-700">
									Due date will be set to: {formatParsedDate(parsedDateResult)}
								</div>
							</div>
							<button
								type="button"
								onclick={applyParsedDate}
								class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
							>
								Apply
							</button>
						</div>
					</div>
				{/if}

				<!-- Parsed Mentions Preview -->
				{#if showMentionSuggestions}
					<div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
						<div class="text-sm font-medium text-purple-900 mb-2">
							✨ Auto-detected from text:
						</div>
						<div class="space-y-2">
							{#if parsedMentions.executor}
								<div class="text-sm text-purple-800">
									<span class="font-medium">Executor:</span>
									<span class="ml-2 px-2 py-0.5 bg-purple-100 rounded">
										@{parsedMentions.executor}
									</span>
									{#if newPeople.includes(parsedMentions.executor)}
										<span class="ml-2 text-xs text-purple-600">(will be created)</span>
									{/if}
								</div>
							{/if}
							{#if parsedMentions.stakeholders.length > 0}
								<div class="text-sm text-purple-800">
									<span class="font-medium">Stakeholders:</span>
									{#each parsedMentions.stakeholders as stakeholder}
										<span class="ml-2 px-2 py-0.5 bg-purple-100 rounded">
											@{stakeholder}
										</span>
										{#if newPeople.includes(stakeholder)}
											<span class="text-xs text-purple-600">(new)</span>
										{/if}
									{/each}
								</div>
							{/if}
							{#if newPeople.length > 0}
								<div class="text-xs text-purple-700 mt-2">
									💡 New people will be created automatically. You can add their emails later in
									<a href="/people" class="underline">People</a>.
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Parsed Projects Preview -->
				{#if showProjectSuggestions}
					<div class="p-4 bg-green-50 border border-green-200 rounded-lg">
						<div class="text-sm font-medium text-green-900 mb-2">
							📁 Auto-detected project:
						</div>
						<div class="space-y-2">
							{#each parsedProjects.projects as project}
								<div class="text-sm text-green-800">
									<span class="font-medium">Project:</span>
									<span class="ml-2 px-2 py-0.5 bg-green-100 rounded">
										#{project}
									</span>
									{#if newProjects.includes(project)}
										<span class="ml-2 text-xs text-green-600">(will be created)</span>
									{/if}
								</div>
							{/each}
							{#if newProjects.length > 0}
								<div class="text-xs text-green-700 mt-2">
									💡 New projects will be created automatically. You can manage them in
									<a href="/projects" class="underline">Projects</a>.
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Toggle Details and AI Assist -->
				<div class="flex items-center gap-4">
					<button
						type="button"
						onclick={() => (showDetails = !showDetails)}
						class="text-sm text-blue-600 hover:text-blue-700 font-medium"
					>
						{showDetails ? '− Hide details' : '+ Add details'}
					</button>

					{#if aiEnabled && !checkingAI}
						<button
							type="button"
							onclick={getAISuggestion}
							disabled={loadingSuggestion || !title.trim()}
							class="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loadingSuggestion ? '✨ Thinking...' : '✨ AI Assist'}
						</button>
					{/if}
				</div>

				{#if showDetails}
					<div class="space-y-4 pt-4 border-t border-gray-200">
						<!-- Description -->
						<div>
							<label for="description" class="block text-sm font-medium text-gray-700 mb-2">
								Description
							</label>
							<textarea
								id="description"
								bind:value={description}
								rows="3"
								placeholder="Additional context or notes..."
								class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							></textarea>
						</div>

						<!-- Due Date and Project -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="dueAt" class="block text-sm font-medium text-gray-700 mb-2">
									Due Date
								</label>
								<input
									id="dueAt"
									type="date"
									bind:value={dueAt}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>

							<div>
								<label for="project" class="block text-sm font-medium text-gray-700 mb-2">
									Project
								</label>
								<select
									id="project"
									bind:value={projectId}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								>
									<option value="">No project</option>
									{#each data.projects as project}
										<option value={project.id}>{project.name}</option>
									{/each}
								</select>
							</div>
						</div>

						<!-- Executor -->
						<div>
							<label for="executor" class="block text-sm font-medium text-gray-700 mb-2">
								Who will execute this?
							</label>
							<select
								id="executor"
								bind:value={executorPersonId}
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							>
								<option value="">Me ({data.currentUser?.displayName})</option>
								{#each data.people.filter((p) => p.id !== data.currentUser?.id) as person}
									<option value={person.id}>{person.displayName} (@{person.handle})</option>
								{/each}
							</select>
						</div>

						<!-- Stakeholders -->
						<div>
							<div class="block text-sm font-medium text-gray-700 mb-2">Stakeholders</div>
							<div class="flex flex-wrap gap-2">
								{#each data.people.filter((p) => p.id !== data.currentUser?.id) as person}
									<button
										type="button"
										onclick={() => toggleStakeholder(person.id)}
										class="px-3 py-1 rounded-full text-sm border transition-colors {selectedStakeholders.includes(
											person.id
										)
											? 'bg-blue-100 border-blue-300 text-blue-700'
											: 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'}"
									>
										{person.displayName}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Action Buttons -->
				<div class="flex justify-between items-center pt-4">
					<a
						href="/board"
						class="text-sm text-gray-600 hover:text-gray-700 font-medium"
					>
						Cancel
					</a>
					<button
						onclick={createTask}
						disabled={isSubmitting || !title.trim()}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
					>
						{isSubmitting ? 'Creating...' : 'Create Task'}
					</button>
				</div>
			</div>
		</div>

		<!-- Quick Tips -->
		<div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
			<h3 class="text-sm font-semibold text-blue-900 mb-2">💡 Quick Tips</h3>
			<ul class="text-sm text-blue-800 space-y-1">
				<li>• Press Enter to quickly create a task with just the title</li>
				<li>• Use <code class="bg-blue-100 px-1 rounded">@name</code> to mention stakeholders</li>
				<li>• Use <code class="bg-blue-100 px-1 rounded">→ @name</code> or <code class="bg-blue-100 px-1 rounded">assign to @name</code> to set executor</li>
				<li>• Use <code class="bg-blue-100 px-1 rounded">#ProjectName</code> to assign to a project</li>
				<li>• Use <code class="bg-blue-100 px-1 rounded">#"Project Name"</code> for projects with spaces or special characters like <code class="bg-blue-100 px-1 rounded">/</code></li>
				<li>• Type dates like <code class="bg-blue-100 px-1 rounded">Thursday</code>, <code class="bg-blue-100 px-1 rounded">next Monday</code>, or <code class="bg-blue-100 px-1 rounded">tomorrow</code> to auto-detect due dates</li>
				<li>• New people and projects are auto-created from @mentions and #tags</li>
			</ul>
		</div>
	</div>
</div>

