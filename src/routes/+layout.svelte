<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { getUserTimezone } from '$lib/utils/timezone';

	let { children } = $props();

	// Set timezone cookie for server-side date calculations
	if (browser) {
		const timezone = getUserTimezone();
		// Set cookie with 1 year expiration
		document.cookie = `user_timezone=${timezone}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $page.url.pathname !== '/'}
		<Nav />
	{/if}
	{@render children()}
</div>
