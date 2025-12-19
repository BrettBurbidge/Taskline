<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateInUserTZ } from '$lib/utils/timezone';

	let { data }: { data: PageData } = $props();

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
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center text-sm text-gray-600 mb-3">
				<a href="/people" class="hover:text-gray-900">People</a>
				<span class="mx-2">›</span>
				<span class="text-gray-900">{data.person.displayName}</span>
			</div>

			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">{data.person.displayName}</h1>
					<p class="text-gray-600 mt-2">@{data.person.handle}</p>
					{#if data.person.email}
						<p class="text-gray-600 mt-1">{data.person.email}</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Accountable Tasks -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-sm border border-gray-200">
					<div class="p-4 border-b border-gray-200">
						<h2 class="text-lg font-semibold text-gray-900">
							👤 Accountable
							<span class="ml-2 text-sm font-normal text-gray-500">
								({data.accountableTasks.active.length + data.accountableTasks.completed.length})
							</span>
						</h2>
					</div>

					{#if data.accountableTasks.active.length === 0 && data.accountableTasks.completed.length === 0}
						<div class="p-8 text-center text-gray-500 text-sm">No tasks</div>
					{:else}
						<div class="divide-y divide-gray-200">
							{#if data.accountableTasks.active.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Active</div>
								</div>
								{#each data.accountableTasks.active as task}
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
													<p class="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
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
													{#if task.project}
														<span class="text-gray-500">
															📁 {task.project.name}
														</span>
													{/if}
												</div>
											</div>
										</div>
									</div>
								{/each}
							{/if}

							{#if data.accountableTasks.completed.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Completed</div>
								</div>
								{#each data.accountableTasks.completed as task}
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
												{#if task.project}
													<span class="text-xs text-gray-500 mt-1">📁 {task.project.name}</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Executor Tasks -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-sm border border-gray-200">
					<div class="p-4 border-b border-gray-200">
						<h2 class="text-lg font-semibold text-gray-900">
							⚡ Executor
							<span class="ml-2 text-sm font-normal text-gray-500">
								({data.executorTasks.active.length + data.executorTasks.completed.length})
							</span>
						</h2>
					</div>

					{#if data.executorTasks.active.length === 0 && data.executorTasks.completed.length === 0}
						<div class="p-8 text-center text-gray-500 text-sm">No tasks</div>
					{:else}
						<div class="divide-y divide-gray-200">
							{#if data.executorTasks.active.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Active</div>
								</div>
								{#each data.executorTasks.active as task}
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
													<p class="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
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
													{#if task.project}
														<span class="text-gray-500">
															📁 {task.project.name}
														</span>
													{/if}
												</div>
											</div>
										</div>
									</div>
								{/each}
							{/if}

							{#if data.executorTasks.completed.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Completed</div>
								</div>
								{#each data.executorTasks.completed as task}
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
												{#if task.project}
													<span class="text-xs text-gray-500 mt-1">📁 {task.project.name}</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Stakeholder Tasks -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-sm border border-gray-200">
					<div class="p-4 border-b border-gray-200">
						<h2 class="text-lg font-semibold text-gray-900">
							👥 Stakeholder
							<span class="ml-2 text-sm font-normal text-gray-500">
								({data.stakeholderTasks.active.length + data.stakeholderTasks.completed.length})
							</span>
						</h2>
					</div>

					{#if data.stakeholderTasks.active.length === 0 && data.stakeholderTasks.completed.length === 0}
						<div class="p-8 text-center text-gray-500 text-sm">No tasks</div>
					{:else}
						<div class="divide-y divide-gray-200">
							{#if data.stakeholderTasks.active.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Active</div>
								</div>
								{#each data.stakeholderTasks.active as task}
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
													<p class="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
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
													{#if task.project}
														<span class="text-gray-500">
															📁 {task.project.name}
														</span>
													{/if}
												</div>
											</div>
										</div>
									</div>
								{/each}
							{/if}

							{#if data.stakeholderTasks.completed.length > 0}
								<div class="p-2 bg-gray-50">
									<div class="text-xs font-medium text-gray-500 uppercase px-2">Completed</div>
								</div>
								{#each data.stakeholderTasks.completed as task}
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
												{#if task.project}
													<span class="text-xs text-gray-500 mt-1">📁 {task.project.name}</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>




