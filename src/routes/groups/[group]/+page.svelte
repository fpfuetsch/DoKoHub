<script lang="ts">
	import { Group } from '$lib/domain/group';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// If group is serialized, rehydrate
	const group: Group = $derived(Group.fromJSON(data.group));
</script>

<div class="mx-auto mt-8 max-w-xl">
	<h1 class="mb-4 text-2xl font-bold">{group.name}</h1>
	<div class="mb-2 text-gray-500">ID: {group.id}</div>
	<div class="mb-6 text-gray-500">Erstellt am: {group.createdAt.toLocaleDateString()}</div>
	<h2 class="mb-2 text-lg font-semibold">Mitglieder</h2>
	{#if group.players.length === 0}
		<div class="text-gray-400 italic">Keine Mitglieder</div>
	{:else}
		<ul class="list-disc pl-6">
			{#each group.players as player}
				<li>{player.name} <span class="text-gray-400">({player.email})</span></li>
			{/each}
		</ul>
	{/if}
</div>
