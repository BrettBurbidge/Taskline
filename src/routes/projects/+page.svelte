<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateInUserTZ } from '$lib/utils/timezone';

	let { data }: { data: PageData } = $props();

	let showCreateProject = $state(false);
	let newProjectName = $state('');
	let newProjectDescription = $state('');
	let newProjectIsPersonal = $state(false);
	let isCreating = $state(false);

	async function createProject() {
		if (!newProjectName.trim()) return;

		isCreating = true;
		try {
			await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newProjectName.trim(),
					description: newProjectDescription.trim() || null,
					isPersonal: newProjectIsPersonal
				})
			});

			// Reset form
			newProjectName = '';
			newProjectDescription = '';
			newProjectIsPersonal = false;
			showCreateProject = false;

			// Reload page data
			window.location.reload();
		} catch (err) {
			console.error('Failed to create project:', err);
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="py-8">
	<div class="max-w-7xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Projects</h1>
				<p class="text-gray-600 mt-2">{data.projects.length} active projects</p>
			</div>
			<button
				onclick={() => (showCreateProject = !showCreateProject)}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
			>
				+ New Project
			</button>
		</div>

		<!-- Create Project Form -->
		{#if showCreateProject}
			<div class="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>
				<div class="space-y-4">
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700 mb-2">
							Project Name *
						</label>
						<input
							id="name"
							type="text"
							bind:value={newProjectName}
							placeholder="e.g., Website Redesign"
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label for="description" class="block text-sm font-medium text-gray-700 mb-2">
							Description
						</label>
						<textarea
							id="description"
							bind:value={newProjectDescription}
							rows="2"
							placeholder="Optional project description..."
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						></textarea>
					</div>
					<div>
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={newProjectIsPersonal}
								class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
							/>
							<span class="text-sm">
								<span class="font-medium text-gray-700">Personal project</span>
								<span class="text-gray-500">
									— kept out of work task lists and summaries
								</span>
							</span>
						</label>
					</div>
					<div class="flex justify-end gap-3">
						<button
							onclick={() => (showCreateProject = false)}
							class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={createProject}
							disabled={isCreating || !newProjectName.trim()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
						>
							{isCreating ? 'Creating...' : 'Create Project'}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Projects Grid -->
		{#if data.projects.length === 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
				<div class="text-4xl mb-4">📁</div>
				<h3 class="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
				<p class="text-gray-600 mb-6">Create your first project to organize tasks</p>
				<button
					onclick={() => (showCreateProject = true)}
					class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
				>
					+ Create Project
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each data.projects as project}
					<a
						href="/projects/{project.id}"
						class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all p-6 block"
					>
						<div class="mb-4">
							<div class="flex items-start justify-between gap-2 mb-1">
								<h3 class="text-lg font-semibold text-gray-900">
									{project.name}
								</h3>
								{#if project.isPersonal}
									<span
										title="Personal — excluded from work summaries"
										class="shrink-0 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"
									>
										Personal
									</span>
								{/if}
							</div>
							{#if project.description}
								<p class="text-sm text-gray-600 line-clamp-2">
									{project.description}
								</p>
							{/if}
						</div>

						{#if project.dueAt}
							<div class="text-sm text-gray-600 mb-4">
								📅 Due {formatDateInUserTZ(project.dueAt, 'MMM d, yyyy')}
							</div>
						{/if}

						<!-- Task Status Summary -->
						{#if project.taskCounts.total > 0}
							<div class="border-t border-gray-200 pt-4">
								<div class="text-xs font-medium text-gray-500 mb-2">
									Task Summary:
								</div>
								<div class="flex flex-wrap gap-2">
									{#if project.taskCounts.inProgress > 0}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
											<span class="w-2 h-2 bg-blue-500 rounded-full"></span>
											{project.taskCounts.inProgress} In Progress
										</span>
									{/if}
									{#if project.taskCounts.notStarted > 0}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
											<span class="w-2 h-2 bg-gray-400 rounded-full"></span>
											{project.taskCounts.notStarted} Not Started
										</span>
									{/if}
									{#if project.taskCounts.waiting > 0}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
											<span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
											{project.taskCounts.waiting} Waiting
										</span>
									{/if}
									{#if project.taskCounts.completed > 0}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
											<span class="w-2 h-2 bg-green-500 rounded-full"></span>
											{project.taskCounts.completed} Completed
										</span>
									{/if}
								</div>
								
								<!-- Total count -->
								<div class="mt-3 text-xs text-gray-500">
									Total: {project.taskCounts.total} task{project.taskCounts.total !== 1 ? 's' : ''}
								</div>
							</div>
						{:else}
							<div class="border-t border-gray-200 pt-4">
								<div class="text-sm text-gray-500 italic">
									No tasks yet
								</div>
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

