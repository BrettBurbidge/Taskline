<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/inbox', label: 'Inbox', icon: '📥' },
		{ href: '/board', label: 'Daily Board', icon: '📋' },
		{ href: '/week', label: 'Week View', icon: '📅' },
		{ href: '/projects', label: 'Projects', icon: '📁' },
		{ href: '/people', label: 'People', icon: '👥' }
	];
</script>

<nav class="bg-white border-b border-gray-200">
	<div class="max-w-7xl mx-auto px-4">
		<div class="flex items-center justify-between h-16">
			<div class="flex items-center space-x-8">
				<a href="/" class="text-xl font-bold text-gray-900">
					Papa
				</a>

				<div class="flex space-x-1">
					{#each navItems as item}
						<a
							href={item.href}
							class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url
								.pathname === item.href
								? 'bg-blue-100 text-blue-700'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
						>
							<span class="mr-2">{item.icon}</span>
							{item.label}
						</a>
					{/each}
				</div>
			</div>

			<div class="flex items-center space-x-4">
				<span class="text-sm text-gray-600">@brett</span>
			</div>
		</div>
	</div>
</nav>

