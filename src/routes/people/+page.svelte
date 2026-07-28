<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showAddForm = $state(false);
	let editingId = $state<string | null>(null);
	let showDeleteConfirm = $state<string | null>(null);

	// Form data
	let newHandle = $state('');
	let newDisplayName = $state('');
	let newEmail = $state('');

	let editData = $state<Record<string, { displayName: string; email: string }>>({});

	function startEdit(personId: string, displayName: string, email: string) {
		editingId = personId;
		editData[personId] = { displayName, email: email || '' };
	}

	function cancelEdit() {
		editingId = null;
		editData = {};
	}

	function resetAddForm() {
		newHandle = '';
		newDisplayName = '';
		newEmail = '';
		showAddForm = false;
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-5xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">People</h1>
				<p class="text-gray-600 mt-2">Manage your contacts and team members</p>
			</div>
			<button
				onclick={() => (showAddForm = !showAddForm)}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
			>
				+ Add Person
			</button>
		</div>

		<!-- Add Person Form -->
		{#if showAddForm}
			<div class="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Add New Person</h2>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update();
							if (result.type === 'success') {
								resetAddForm();
								await invalidateAll();
							}
						};
					}}
				>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label for="handle" class="block text-sm font-medium text-gray-700 mb-2">
								Handle * <span class="text-gray-500">(unique username)</span>
							</label>
							<div class="relative">
								<span
									class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
								>@</span>
								<input
									id="handle"
									name="handle"
									type="text"
									bind:value={newHandle}
									required
									pattern="[a-zA-Z0-9_]+"
									placeholder="gwenith"
									class="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>
						<div>
							<label for="displayName" class="block text-sm font-medium text-gray-700 mb-2">
								Display Name *
							</label>
							<input
								id="displayName"
								name="displayName"
								type="text"
								bind:value={newDisplayName}
								required
								placeholder="Gwenith Smith"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
						</div>
						<div>
							<label for="email" class="block text-sm font-medium text-gray-700 mb-2">
								Email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								bind:value={newEmail}
								placeholder="gwenith@example.com"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-4">
						<button
							type="button"
							onclick={resetAddForm}
							class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Add Person
						</button>
					</div>
				</form>
			</div>
		{/if}

		<!-- People List -->
		{#if data.people.length === 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
				<div class="text-4xl mb-4">👥</div>
				<h3 class="text-lg font-semibold text-gray-900 mb-2">No people yet</h3>
				<p class="text-gray-600 mb-6">Add people to delegate tasks and manage stakeholders</p>
				<button
					onclick={() => (showAddForm = true)}
					class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
				>
					+ Add First Person
				</button>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Person
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Email
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Tasks
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Usage
								</th>
								<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each data.people as person}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4">
										{#if editingId === person.id}
											<input
												type="text"
												bind:value={editData[person.id].displayName}
												class="px-3 py-1 border border-gray-300 rounded"
											/>
										{:else}
											<div>
												<a
													href="/people/{person.handle}"
													class="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
												>
													{person.displayName}
												</a>
												<div class="text-sm text-gray-500">@{person.handle}</div>
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										{#if editingId === person.id}
											<input
												type="email"
												bind:value={editData[person.id].email}
												placeholder="email@example.com"
												class="px-3 py-1 border border-gray-300 rounded w-full"
											/>
										{:else}
											<div class="text-sm text-gray-700">
												{#if person.email}
													{person.email}
												{:else}
													<span class="text-gray-400 italic">No email</span>
												{/if}
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										{#if person.taskCounts.open === 0 && person.taskCounts.closed === 0}
											<span class="text-sm text-gray-400 italic">No tasks</span>
										{:else}
											<div class="flex items-center gap-2 text-sm whitespace-nowrap">
												<span class="font-medium text-blue-700">
													{person.taskCounts.open} Open
												</span>
												<span class="text-gray-300">/</span>
												<span class="text-gray-500">
													{person.taskCounts.closed} Closed
												</span>
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										<div class="flex gap-3 text-sm text-gray-600">
											{#if person._count.accountableTasks > 0}
												<span title="Accountable">👤 {person._count.accountableTasks}</span>
											{/if}
											{#if person._count.executorTasks > 0}
												<span title="Executor">⚡ {person._count.executorTasks}</span>
											{/if}
											{#if person._count.stakeholderOn > 0}
												<span title="Stakeholder">👥 {person._count.stakeholderOn}</span>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4 text-right">
										{#if editingId === person.id}
											<form
												method="POST"
												action="?/update"
												use:enhance={() => {
													return async ({ update }) => {
														await update();
														cancelEdit();
														await invalidateAll();
													};
												}}
												class="inline-flex gap-2"
											>
												<input type="hidden" name="id" value={person.id} />
												<input
													type="hidden"
													name="displayName"
													value={editData[person.id].displayName}
												/>
												<input type="hidden" name="email" value={editData[person.id].email} />
												<button
													type="submit"
													class="text-sm text-blue-600 hover:text-blue-700 font-medium"
												>
													Save
												</button>
												<button
													type="button"
													onclick={cancelEdit}
													class="text-sm text-gray-600 hover:text-gray-700"
												>
													Cancel
												</button>
											</form>
										{:else}
											<div class="inline-flex gap-3">
												<button
													onclick={() => startEdit(person.id, person.displayName, person.email || '')}
													class="text-sm text-blue-600 hover:text-blue-700 font-medium"
												>
													Edit
												</button>
												{#if showDeleteConfirm === person.id}
													<form
														method="POST"
														action="?/delete"
														use:enhance={() => {
															return async ({ update }) => {
																await update();
																showDeleteConfirm = null;
																await invalidateAll();
															};
														}}
														class="inline"
													>
														<input type="hidden" name="id" value={person.id} />
														<button
															type="submit"
															class="text-sm text-red-600 hover:text-red-700 font-medium"
														>
															Confirm
														</button>
													</form>
													<button
														onclick={() => (showDeleteConfirm = null)}
														class="text-sm text-gray-600"
													>
														Cancel
													</button>
												{:else}
													<button
														onclick={() => (showDeleteConfirm = person.id)}
														class="text-sm text-red-600 hover:text-red-700"
													>
														Delete
													</button>
												{/if}
											</div>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Info Box -->
			<div class="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
				<h3 class="text-sm font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
				<ul class="text-sm text-blue-800 space-y-1">
					<li>• Use <code class="bg-blue-100 px-1 rounded">@handle</code> in tasks to mention stakeholders</li>
					<li>• Use <code class="bg-blue-100 px-1 rounded">→ @handle</code> to assign an executor</li>
					<li>• Add emails to enable AI-drafted follow-up messages</li>
					<li>• People are auto-created when you use new @mentions</li>
				</ul>
			</div>
		{/if}
	</div>
</div>

