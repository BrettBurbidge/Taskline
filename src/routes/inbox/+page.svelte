<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { parseMentions, parseProjects, cleanTaskTitle } from '$lib/utils/mentions';
	import { parseDate, formatParsedDate, formatParsedDateForInput } from '$lib/utils/dateParser';
	import { getUserTimezone } from '$lib/utils/timezone';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let description = $state('');
	let dueAt = $state('');
	let projectId = $state('');
	let executorPersonId = $state(data.currentUser?.id || '');
	let selectedStakeholders = $state<string[]>([]);
	let showDetails = $state(false);
	let isSubmitting = $state(false);
	let errorMessage = $state('');
	let aiEnabled = $state(false);
	let checkingAI = $state(true);
	let aiSuggestion = $state<any>(null);
	let loadingSuggestion = $state(false);
	
	// Audio recording state
	let isRecording = $state(false);
	let recordingTime = $state(0);
	let mediaRecorder: MediaRecorder | null = $state(null);
	let audioStream: MediaStream | null = $state(null);
	let audioChunks: Blob[] = $state([]);
	let recordingInterval: ReturnType<typeof setInterval> | null = $state(null);
	let isProcessingAudio = $state(false);
	let transcribedTasks = $state<any[]>([]);
	let showTasksModal = $state(false);

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

	// Generate cleaned title preview
	let cleanedTitlePreview = $derived.by(() => {
		if (!title.trim()) return '';
		const cleaned = cleanTaskTitle(title, parsedDateResult.matchedText);
		// Only show preview if it's different from original and has content
		return cleaned && cleaned !== title.trim() ? cleaned : '';
	});

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
		// Default to selected executor (which defaults to current user)
		let finalExecutorId = executorPersonId;
		
		// If @mention found for executor, it overrides the selection
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

			// Step 5: Create the task with cleaned title
			const cleanedTitle = cleanTaskTitle(title, parsedDateResult.matchedText);
			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: cleanedTitle || title.trim(), // Use cleaned title, fallback to original if empty
					description: description.trim() || null,
					dueAt: finalDueAt || null,
					projectId: finalProjectId,
					accountablePersonId: data.currentUser!.id,
					executorPersonId: finalExecutorId,
					stakeholderPersonIds: stakeholderIds.length > 0 ? stakeholderIds : selectedStakeholders,
					boardDate: new Date().toISOString().split('T')[0],
					timezone: getUserTimezone()
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
		executorPersonId = data.currentUser?.id || '';
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

	// Audio recording functions
	async function startRecording() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioStream = stream;
			mediaRecorder = new MediaRecorder(stream);
			audioChunks = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks = [...audioChunks, event.data];
				}
			};

			mediaRecorder.onstop = async () => {
				if (audioStream) {
					audioStream.getTracks().forEach((track) => track.stop());
					audioStream = null;
				}
				await processAudioRecording();
			};

			mediaRecorder.start();
			isRecording = true;
			recordingTime = 0;
			recordingInterval = setInterval(() => {
				recordingTime++;
			}, 1000);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to start recording. Please allow microphone access.';
			isRecording = false;
			audioStream = null;
		}
	}

	function stopRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			isRecording = false;
			if (recordingInterval) {
				clearInterval(recordingInterval);
				recordingInterval = null;
			}
		}
	}

	function cancelRecording() {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
		}
		if (audioStream) {
			audioStream.getTracks().forEach((track) => track.stop());
			audioStream = null;
		}
		isRecording = false;
		audioChunks = [];
		recordingTime = 0;
		if (recordingInterval) {
			clearInterval(recordingInterval);
			recordingInterval = null;
		}
		transcribedTasks = [];
		showTasksModal = false;
		mediaRecorder = null;
	}

	function removeTask(index: number) {
		transcribedTasks = transcribedTasks.filter((_, i) => i !== index);
	}

	function addEmptyTask() {
		transcribedTasks = [
			...transcribedTasks,
			{
				title: '',
				description: null,
				dueDate: null,
				executor: null,
				stakeholders: [],
				project: null,
			},
		];
	}

	function formatRecordingTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	async function processAudioRecording() {
		if (audioChunks.length === 0) {
			errorMessage = 'No audio recorded';
			return;
		}

		isProcessingAudio = true;
		errorMessage = '';

		try {
			const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
			// Convert Blob to File for OpenAI API
			const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
			const formData = new FormData();
			formData.append('audio', audioFile);
			formData.append('currentDate', new Date().toISOString());

			const response = await fetch('/api/ai/transcribe-audio', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to transcribe audio');
			}

			const result = await response.json();
			transcribedTasks = result.tasks || [];

			// Create new people that were detected in the transcription
			if (result.newPeople && result.newPeople.length > 0) {
				for (const newPerson of result.newPeople) {
					// Check if person already exists
					const exists = data.people.find(
						(p) => p.handle.toLowerCase() === newPerson.handle.toLowerCase()
					);
					
					if (!exists) {
						try {
							const response = await fetch('/api/people', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									handle: newPerson.handle.toLowerCase(),
									displayName: newPerson.displayName,
									source: 'mention'
								})
							});
							
							if (response.ok) {
								const createdPerson = await response.json();
								// Add to local data so it's available in the modal
								data.people = [...data.people, createdPerson];
							}
						} catch (err) {
							console.warn(`Failed to create person @${newPerson.handle}:`, err);
						}
					}
				}
			}

			if (transcribedTasks.length === 0) {
				errorMessage = 'No tasks found in the recording';
			} else {
				// Show modal for editing tasks instead of auto-creating
				showTasksModal = true;
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to process audio';
		} finally {
			isProcessingAudio = false;
			audioChunks = [];
		}
	}

	async function createTasksFromTranscription(tasks: any[]) {
		isSubmitting = true;
		errorMessage = '';

		try {
			// Process each task
			for (const task of tasks) {
				// Step 1: Create any new people mentioned
				const createdPeople = new Map<string, string>();
				const allMentions = [
					...(task.stakeholders || []),
					...(task.executor ? [task.executor] : [])
				];

				for (const mention of allMentions) {
					const handle = mention.replace('@', '').toLowerCase();
					const existingPerson = data.people.find((p) => p.handle.toLowerCase() === handle);
					
					if (!existingPerson && !createdPeople.has(handle)) {
						try {
							const response = await fetch('/api/people', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									handle: handle,
									displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
									source: 'mention'
								})
							});
							
							if (response.ok) {
								const person = await response.json();
								createdPeople.set(handle, person.id);
							}
						} catch (err) {
							console.warn(`Failed to create person @${handle}:`, err);
						}
					}
				}

				// Step 2: Map handles to person IDs
				const stakeholderIds: string[] = [];
				for (const mention of (task.stakeholders || [])) {
					const handle = mention.replace('@', '').toLowerCase();
					if (createdPeople.has(handle)) {
						stakeholderIds.push(createdPeople.get(handle)!);
					} else {
						const person = data.people.find((p) => p.handle.toLowerCase() === handle);
						if (person) {
							stakeholderIds.push(person.id);
						}
					}
				}

				// Step 3: Determine executor
				let finalExecutorId = data.currentUser!.id;
				if (task.executor) {
					const handle = task.executor.replace('@', '').toLowerCase();
					if (createdPeople.has(handle)) {
						finalExecutorId = createdPeople.get(handle)!;
					} else {
						const person = data.people.find((p) => p.handle.toLowerCase() === handle);
						if (person) {
							finalExecutorId = person.id;
						}
					}
				}

				// Step 4: Handle project
				let finalProjectId = null;
				if (task.project) {
					// Remove # if present
					const projectName = task.project.replace(/^#/, '').trim();
					const existingProject = data.projects.find(
						(p) => p.name.toLowerCase() === projectName.toLowerCase()
					);
					
					if (existingProject) {
						finalProjectId = existingProject.id;
					} else {
						// Create new project
						const hasSpacesOrSpecialChars = /\s|[^a-zA-Z0-9_]/.test(projectName);
						const nameToCreate = hasSpacesOrSpecialChars
							? projectName
							: projectName.charAt(0).toUpperCase() + projectName.slice(1).toLowerCase();
						
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

				// Step 5: Create the task
				await fetch('/api/tasks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: task.title.trim(),
						description: task.description?.trim() || null,
						dueAt: task.dueDate || null,
						projectId: finalProjectId,
						accountablePersonId: data.currentUser!.id,
						executorPersonId: finalExecutorId,
						stakeholderPersonIds: stakeholderIds,
						boardDate: new Date().toISOString().split('T')[0]
					})
				});
			}

		// Reset form and redirect
		title = '';
		description = '';
		dueAt = '';
		projectId = '';
		executorPersonId = data.currentUser?.id || '';
		selectedStakeholders = [];
		showDetails = false;
		transcribedTasks = [];

		// Redirect to board
		goto('/board');
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to create tasks from audio';
		} finally {
			isSubmitting = false;
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
					<div class="flex items-center justify-between mb-2">
						<label for="title" class="block text-sm font-medium text-gray-700">
							Task Title *
						</label>
						{#if aiEnabled && !checkingAI}
							<div class="flex items-center gap-2">
								{#if isRecording}
									<button
										type="button"
										onclick={stopRecording}
										class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
									>
										<span class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
										<span>Stop ({formatRecordingTime(recordingTime)})</span>
									</button>
									<button
										type="button"
										onclick={cancelRecording}
										class="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
									>
										Cancel
									</button>
								{:else if isProcessingAudio}
									<button
										type="button"
										disabled
										class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-100 text-blue-700 disabled:opacity-50"
									>
										<span>🎤 Processing audio...</span>
									</button>
								{:else}
									<button
										type="button"
										onclick={startRecording}
										disabled={isSubmitting}
										class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<span>🎤 Record</span>
									</button>
								{/if}
							</div>
						{/if}
					</div>
					<input
						id="title"
						type="text"
						bind:value={title}
						onkeypress={handleKeyPress}
						placeholder="What needs to be done?"
						disabled={isRecording || isProcessingAudio}
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>

				<!-- Cleaned Title Preview -->
				{#if cleanedTitlePreview}
					<div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<div class="flex items-start gap-2">
							<span class="text-blue-600 text-lg">✨</span>
							<div class="flex-1">
								<div class="text-sm font-medium text-blue-900 mb-1">
									Task will be created as:
								</div>
								<div class="text-base text-gray-900 font-medium">
									{cleanedTitlePreview}
								</div>
								<div class="text-xs text-blue-700 mt-1">
									Projects, dates, and @mentions will be automatically tagged
				</div>
							</div>
						</div>
					</div>
				{/if}

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
							<option value={data.currentUser?.id}>Me ({data.currentUser?.displayName})</option>
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
					<button
						type="button"
						onclick={() => {
							if (isRecording) {
								cancelRecording();
							}
							goto('/board');
						}}
						class="text-sm text-gray-600 hover:text-gray-700 font-medium"
					>
						Cancel
					</button>
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
				<li>• Click <code class="bg-blue-100 px-1 rounded">🎤 Record</code> to record audio and extract multiple tasks automatically</li>
			</ul>
		</div>
	</div>

	<!-- Tasks Review Modal -->
	{#if showTasksModal && transcribedTasks.length > 0}
		<div
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
			onclick={(e) => {
				if (e.target === e.currentTarget && !isSubmitting) {
					showTasksModal = false;
				}
			}}
		>
			<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
				<div class="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
					<div class="flex items-center justify-between mb-2">
						<h2 class="text-2xl font-bold text-gray-900">
							🎤 Review Tasks from Recording
						</h2>
						<button
							type="button"
							onclick={() => (showTasksModal = false)}
							class="text-gray-400 hover:text-gray-600 text-2xl"
						>
							×
						</button>
					</div>
					<p class="text-sm text-gray-600">
						Edit tasks below, then click "Create All Tasks" to add them to your board.
					</p>
				</div>

				<div class="p-6 space-y-4">
					{#each transcribedTasks as task, index}
						<div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
							<div class="flex items-start justify-between mb-3">
								<span class="text-sm font-medium text-gray-500">Task {index + 1}</span>
								<button
									type="button"
									onclick={() => removeTask(index)}
									class="text-red-600 hover:text-red-700 text-sm font-medium"
								>
									Remove
								</button>
							</div>

							<div class="space-y-3">
								<!-- Title -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">
										Title *
									</label>
									<input
										type="text"
										bind:value={task.title}
										placeholder="Task title"
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
									/>
								</div>

								<!-- Description -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">
										Description
									</label>
									<textarea
										bind:value={task.description}
										placeholder="Additional context..."
										rows="2"
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
									></textarea>
								</div>

								<!-- Due Date and Project -->
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">
											Due Date
										</label>
										<input
											type="date"
											bind:value={task.dueDate}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
										/>
									</div>

									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">
											Project
										</label>
										<input
											type="text"
											bind:value={task.project}
											placeholder="#ProjectName or Project Name"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
										/>
										<div class="mt-1 text-xs text-gray-500">
											Use #ProjectName for existing projects, or type a new project name
										</div>
									</div>
								</div>

								<!-- Executor -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">
										Executor
									</label>
									<select
										bind:value={task.executor}
										class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
									>
										<option value="">Me ({data.currentUser?.displayName})</option>
										{#each data.people.filter((p) => p.id !== data.currentUser?.id) as person}
											<option value={`@${person.handle}`}>
												{person.displayName} (@{person.handle})
											</option>
										{/each}
									</select>
								</div>

								<!-- Stakeholders -->
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">
										Stakeholders
									</label>
									<div class="flex flex-wrap gap-2">
										{#each data.people.filter((p) => p.id !== data.currentUser?.id) as person}
											<button
												type="button"
												onclick={() => {
													const handle = `@${person.handle}`;
													if (!task.stakeholders) {
														task.stakeholders = [];
													}
													const index = task.stakeholders.indexOf(handle);
													if (index === -1) {
														task.stakeholders = [...task.stakeholders, handle];
													} else {
														task.stakeholders = task.stakeholders.filter((h) => h !== handle);
													}
												}}
												class="px-3 py-1 rounded-full text-sm border transition-colors {(task.stakeholders || []).includes(
													`@${person.handle}`
												)
													? 'bg-blue-100 border-blue-300 text-blue-700'
													: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}"
											>
												{person.displayName}
											</button>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/each}

					<!-- Add Task Button -->
					<button
						type="button"
						onclick={addEmptyTask}
						class="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium"
					>
						+ Add Another Task
					</button>
				</div>

				<!-- Modal Footer -->
				<div class="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-between items-center">
					<button
						type="button"
						onclick={() => {
							showTasksModal = false;
							transcribedTasks = [];
						}}
						disabled={isSubmitting}
						class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={async () => {
							// Filter out tasks without titles
							const validTasks = transcribedTasks.filter((t) => t.title?.trim());
							if (validTasks.length === 0) {
								errorMessage = 'Please add at least one task with a title';
								return;
							}
							showTasksModal = false;
							await createTasksFromTranscription(validTasks);
							transcribedTasks = [];
						}}
						disabled={isSubmitting || transcribedTasks.filter((t) => t.title?.trim()).length === 0}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
					>
						{isSubmitting ? 'Creating...' : `Create ${transcribedTasks.filter((t) => t.title?.trim()).length} Task${transcribedTasks.filter((t) => t.title?.trim()).length === 1 ? '' : 's'}`}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

