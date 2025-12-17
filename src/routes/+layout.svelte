<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import { page } from '$app/stores';

	let { children } = $props();
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
