<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { formatDateInUserTZ } from '$lib/utils/timezone';

	let { data }: { data: PageData } = $props();

	let showDeleteModal = $state(false);
	let selectedMoveToProject = $state<string>('none');
	let isDeleting = $state(false);
	let deleteError = $state('');
	let isCompleting = $state(false);

	function getStatusColor(status: string) {
		switch (status) {
			case 'not_started':
				return 'bg-gray-100 text-gray-700';
			case 'in_progress':
				return 'bg-blue-100 text-blue-700';
			case 'waiting':
				return 'bg-yellow-100 text-yellow-700';
			case 'completed':
				return 'bg-green-100 text-green-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	}

	async function completeProject() {
		if (!confirm(`Mark "${data.project.name}" as completed? This will delete all pending follow-ups for tasks in this project.`)) {
			return;
		}

		isCompleting = true;

		try {
			const response = await fetch(`/api/projects/${data.project.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					isActive: false,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to complete project');
			}

			// Reload the page to show updated status
			window.location.reload();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to complete project');
		} finally {
			isCompleting = false;
		}
	}

	async function deleteProject() {
		if (!confirm(`Are you sure you want to delete "${data.project.name}"?`)) {
			return;
		}

		isDeleting = true;
		deleteError = '';

		try {
			const response = await fetch(`/api/projects/${data.project.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					moveToProjectId: selectedMoveToProject === 'none' ? null : selectedMoveToProject,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to delete project');
			}

			// Redirect to projects list
			goto('/projects');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete project';
		} finally {
			isDeleting = false;
		}
	}
</script>

<div class="py-8">
	<div class="max-w-7xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center text-sm text-gray-600 mb-3">
				<a href="/projects" class="hover:text-gray-900">Projects</a>
				<span class="mx-2">›</span>
				<span class="text-gray-900">{data.project.name}</span>
			</div>

			<div class="flex items-start justify-between">
				<div class="flex-1">
					<h1 class="text-3xl font-bold text-gray-900">{data.project.name}</h1>
					{#if data.project.description}
						<p class="text-gray-600 mt-2">{data.project.description}</p>
					{/if}
					{#if data.project.dueAt}
						<div class="text-gray-600 mt-3">
							📅 Due {formatDateInUserTZ(data.project.dueAt, 'MMMM d, yyyy')}
						</div>
					{/if}
				</div>

				<div class="flex gap-3">
					<a
						href="/inbox"
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
					>
						+ Add Task
					</a>
					{#if data.project.isActive}
						<button
							type="button"
							onclick={completeProject}
							disabled={isCompleting}
							class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isCompleting ? 'Completing...' : '✓ Mark as Completed'}
						</button>
					{/if}
					<button
						type="button"
						onclick={() => (showDeleteModal = true)}
						class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
					>
						🗑️ Delete Project
					</button>
				</div>
			</div>
		</div>

		<!-- Delete Confirmation Modal -->
		{#if showDeleteModal}
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
					<h2 class="text-xl font-bold text-gray-900 mb-4">Delete Project</h2>

					{#if deleteError}
						<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
							{deleteError}
						</div>
					{/if}

					{#if data.project.tasks.length > 0}
						<div class="mb-4">
							<p class="text-gray-700 mb-4">
								This project has <strong>{data.project.tasks.length} task(s)</strong>. What
								would you like to do with them?
							</p>

							<div class="space-y-2">
								<label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
									<input
										type="radio"
										name="moveProject"
										value="none"
										bind:group={selectedMoveToProject}
										class="mr-3"
									/>
									<div>
										<div class="font-medium text-gray-900">No Project</div>
										<div class="text-sm text-gray-600">Tasks will stand alone without a project</div>
									</div>
								</label>

								{#each data.otherProjects as project}
									<label class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
										<input
											type="radio"
											name="moveProject"
											value={project.id}
											bind:group={selectedMoveToProject}
											class="mr-3"
										/>
										<div>
											<div class="font-medium text-gray-900">{project.name}</div>
										</div>
									</label>
								{/each}
							</div>
						</div>
					{:else}
						<p class="text-gray-700 mb-4">
							This project has no tasks. Are you sure you want to delete it?
						</p>
					{/if}

					<div class="flex gap-3 justify-end">
						<button
							onclick={() => {
								showDeleteModal = false;
								deleteError = '';
								selectedMoveToProject = 'none';
							}}
							disabled={isDeleting}
							class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							onclick={deleteProject}
							disabled={isDeleting}
							class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
						>
							{isDeleting ? 'Deleting...' : 'Delete Project'}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Stats -->
		<div class="grid grid-cols-3 gap-4 mb-8">
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-600">Active Tasks</div>
				<div class="text-2xl font-bold text-gray-900 mt-1">
					{data.tasksByStatus.active.length}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-600">Completed</div>
				<div class="text-2xl font-bold text-green-600 mt-1">
					{data.tasksByStatus.completed.length}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-600">Total</div>
				<div class="text-2xl font-bold text-gray-900 mt-1">
					{data.project.tasks.length}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Tasks Column -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Active Tasks -->
				<div class="bg-white rounded-lg shadow-sm border border-gray-200">
					<div class="p-4 border-b border-gray-200">
						<h2 class="text-lg font-semibold text-gray-900">
							Active Tasks
							<span class="ml-2 text-sm font-normal text-gray-500"
								>({data.tasksByStatus.active.length})</span
							>
						</h2>
					</div>

					{#if data.tasksByStatus.active.length === 0}
						<div class="p-8 text-center text-gray-500">No active tasks</div>
					{:else}
						<div class="divide-y divide-gray-200">
							{#each data.tasksByStatus.active as task}
								<div class="p-4 hover:bg-gray-50 transition-colors">
									<div class="flex items-start justify-between">
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
												<p class="text-sm text-gray-600 mt-1">{task.description}</p>
											{/if}
											<div class="flex items-center gap-3 mt-2 text-sm">
												<span
													class="px-2 py-1 rounded-full text-xs font-medium {getStatusColor(
														task.status
													)}"
												>
													{task.status.replace('_', ' ')}
												</span>
												{#if task.dueAt}
													<span class="text-gray-500">
														📅 {formatDateInUserTZ(task.dueAt, 'MMM d')}
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
										<a
											href="/tasks/{task.id}"
											class="ml-4 text-sm text-blue-600 hover:text-blue-700"
										>
											View →
										</a>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Completed Tasks -->
				{#if data.tasksByStatus.completed.length > 0}
					<div class="bg-white rounded-lg shadow-sm border border-gray-200">
						<div class="p-4 border-b border-gray-200">
							<h2 class="text-lg font-semibold text-gray-900">
								Completed Tasks
								<span class="ml-2 text-sm font-normal text-gray-500"
									>({data.tasksByStatus.completed.length})</span
								>
							</h2>
						</div>

						<div class="divide-y divide-gray-200">
							{#each data.tasksByStatus.completed as task}
								<div class="p-4 hover:bg-gray-50 transition-colors opacity-75">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<h3 class="font-medium text-gray-900 line-through">
												<a 
													href="/tasks/{task.id}"
													class="hover:text-blue-600 hover:underline transition-colors"
												>
													{task.title}
												</a>
											</h3>
											<div class="flex items-center gap-3 mt-2 text-sm">
												<span class="text-green-600">
													✓ Completed
													{#if task.completedAt}
														{formatDateInUserTZ(task.completedAt, 'MMM d')}
													{/if}
												</span>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Context Notes Sidebar -->
			<div>
				<div class="bg-white rounded-lg shadow-sm border border-gray-200">
					<div class="p-4 border-b border-gray-200">
						<h2 class="text-lg font-semibold text-gray-900">Context Notes</h2>
					</div>

					{#if data.project.contextNotes.length === 0}
						<div class="p-6 text-center text-gray-500 text-sm">
							No notes yet. Add context about this project.
						</div>
					{:else}
						<div class="divide-y divide-gray-200">
							{#each data.project.contextNotes as note}
								<div class="p-4">
									<div class="text-sm text-gray-700 whitespace-pre-wrap">
										{note.content}
									</div>
									<div class="text-xs text-gray-500 mt-2">
										{formatDateInUserTZ(note.createdAt, 'MMM d, h:mm a')}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Project Info -->
				<div class="mt-4 bg-blue-50 rounded-lg border border-blue-200 p-4">
					<h3 class="text-sm font-semibold text-blue-900 mb-2">Project Info</h3>
					<div class="space-y-2 text-sm text-blue-800">
						<div class="flex justify-between">
							<span>Created:</span>
							<span class="font-medium">
								{formatDateInUserTZ(data.project.createdAt, 'MMM d, yyyy')}
							</span>
						</div>
						<div class="flex justify-between">
							<span>Status:</span>
							<span class="font-medium">
								{data.project.isActive ? 'Active' : 'Inactive'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

