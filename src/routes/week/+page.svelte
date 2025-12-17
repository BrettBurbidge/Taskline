<script lang="ts">
	import { parseISO } from 'date-fns';
	import type { PageData} from './$types';
	import { formatDateInUserTZ } from '$lib/utils/timezone';

	let { data }: { data: PageData } = $props();

	function getStatusColor(status: string) {
		switch (status) {
			case 'not_started':
				return 'border-l-gray-400';
			case 'in_progress':
				return 'border-l-blue-500';
			case 'waiting':
				return 'border-l-yellow-500';
			case 'completed':
				return 'border-l-green-500';
			default:
				return 'border-l-gray-400';
		}
	}

	function getDayName(dateStr: string) {
		return formatDateInUserTZ(parseISO(dateStr), 'EEE');
	}

	function getDayNumber(dateStr: string) {
		return formatDateInUserTZ(parseISO(dateStr), 'd');
	}

	function isToday(dateStr: string) {
		const today = formatDateInUserTZ(new Date(), 'yyyy-MM-dd');
		return dateStr === today;
	}

	function getWeekLabel(offset: number): string {
		if (offset === 0) return 'This Week';
		if (offset === 1) return 'Next Week';
		if (offset === -1) return 'Last Week';
		if (offset > 1) return `${offset} Weeks Ahead`;
		return `${Math.abs(offset)} Weeks Ago`;
	}
</script>

<div class="py-8">
	<div class="max-w-7xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Week View</h1>
				<p class="text-gray-600 mt-2">
					{formatDateInUserTZ(parseISO(data.weekStart), 'MMM d')} - {formatDateInUserTZ(
						parseISO(data.weekEnd),
						'MMM d, yyyy'
					)}
				</p>
			</div>
			<div class="flex items-center gap-3">
				<a
					href="/inbox"
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
				>
					+ Add Task
				</a>
			</div>
		</div>

		<!-- Week Navigation -->
		<div class="mb-6 flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
			<a
				href="/week?offset={data.weekOffset - 1}"
				class="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
			>
				← Previous Week
			</a>

			<div class="flex items-center gap-4">
				{#if data.weekOffset !== 0}
					<a
						href="/week"
						class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
					>
						This Week
					</a>
				{/if}
				<div class="text-center">
					<div class="text-sm text-gray-600">{getWeekLabel(data.weekOffset)}</div>
					<div class="text-lg font-bold text-gray-900">
						{formatDateInUserTZ(parseISO(data.weekStart), 'MMM d')} - {formatDateInUserTZ(
							parseISO(data.weekEnd),
							'MMM d'
						)}
					</div>
				</div>
			</div>

			<a
				href="/week?offset={data.weekOffset + 1}"
				class="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
			>
				Next Week →
			</a>
		</div>

		<!-- Overdue Tasks -->
		{#if data.overdueTasks.length > 0}
			<div class="mb-6 bg-red-50 rounded-lg border border-red-200 p-4">
				<h2 class="text-lg font-semibold text-red-900 mb-3">
					⚠️ Overdue ({data.overdueTasks.length})
				</h2>
				<div class="space-y-2">
					{#each data.overdueTasks as task}
						<a
							href="/tasks/{task.id}"
							class="block bg-white p-3 rounded border-l-4 {getStatusColor(task.status)} shadow-sm hover:shadow-md transition-shadow"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h3 class="font-medium text-gray-900">{task.title}</h3>
									<div class="flex items-center gap-3 mt-1 text-sm text-gray-600">
										{#if task.dueAt}
											<span>📅 {formatDateInUserTZ(task.dueAt, 'MMM d')}</span>
										{/if}
										{#if task.project}
											<span>📁 {task.project.name}</span>
										{/if}
										<span class="text-xs px-2 py-0.5 bg-gray-100 rounded">
											{task.status.replace('_', ' ')}
										</span>
									</div>
								</div>
								<span class="text-sm text-blue-600">
									View →
								</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Week Grid -->
		<div class="grid grid-cols-1 md:grid-cols-7 gap-4">
			{#each data.weekDates as date}
				<div
					class="bg-white rounded-lg border {isToday(date)
						? 'border-blue-500 ring-2 ring-blue-100'
						: 'border-gray-200'} overflow-hidden"
				>
					<div
						class="p-3 {isToday(date)
							? 'bg-blue-50 border-b border-blue-200'
							: 'bg-gray-50 border-b border-gray-200'}"
					>
						<div class="text-xs font-medium text-gray-600">
							{getDayName(date)}
						</div>
						<div
							class="text-2xl font-bold {isToday(date) ? 'text-blue-600' : 'text-gray-900'}"
						>
							{getDayNumber(date)}
						</div>
					</div>

					<div class="p-3 space-y-2 min-h-[200px]">
						{#if data.tasksByDate[date] && data.tasksByDate[date].length > 0}
							{#each data.tasksByDate[date] as task}
								<a
									href="/tasks/{task.id}"
									class="block p-2 bg-gray-50 rounded border-l-4 {getStatusColor(
										task.status
									)} hover:bg-gray-100 transition-colors cursor-pointer"
								>
									<h4 class="text-sm font-medium text-gray-900 line-clamp-2">
										{task.title}
									</h4>
									<div class="flex items-center gap-2 mt-1">
										{#if task.project}
											<span class="text-xs text-gray-500">
												{task.project.name}
											</span>
										{/if}
										{#if task.executorPerson && task.executorPerson.id !== task.accountablePerson.id}
											<span class="text-xs text-gray-500">
												→ @{task.executorPerson.handle}
											</span>
										{/if}
									</div>
								</a>
							{/each}
						{:else}
							<div class="text-center text-gray-400 text-sm pt-8">No tasks</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- No Due Date Tasks -->
		{#if data.noDueDateTasks.length > 0}
			<div class="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-3">
					No Due Date ({data.noDueDateTasks.length})
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
					{#each data.noDueDateTasks as task}
						<a
							href="/tasks/{task.id}"
							class="block bg-white p-3 rounded border-l-4 {getStatusColor(task.status)} shadow-sm hover:shadow-md transition-shadow"
						>
							<h3 class="font-medium text-gray-900">{task.title}</h3>
							<div class="flex items-center gap-3 mt-1 text-sm text-gray-600">
								{#if task.project}
									<span>📁 {task.project.name}</span>
								{/if}
								<span class="text-xs px-2 py-0.5 bg-gray-100 rounded">
									{task.status.replace('_', ' ')}
								</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

