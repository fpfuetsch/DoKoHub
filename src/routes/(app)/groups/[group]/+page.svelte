<script lang="ts">
	import { Group } from '$lib/domain/group';
	import { Button, Tabs, TabItem } from "flowbite-svelte";
	import { ArrowLeftOutline, PlayOutline, ChartOutline, UsersGroupSolid } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const group: Group | null = $derived(data.group);
</script>


<div class="sticky top-0 z-30 bg-white flex items-center h-14 px-2">
	<Button color="white" size="sm" class="w-10 h-10 flex items-center justify-center" pill={true} onclick={() => history.length > 1 ? history.back() : goto('/groups')} aria-label="Zurück">
		<ArrowLeftOutline class="w-6 h-6" />
	</Button>
	<div class="flex-1 text-center font-semibold text-2xl truncate">
		{group ? group.name : ''}
	</div>
	<div class="w-10 h-10"></div> <!-- Spacer for symmetry -->
</div>

<div class="w-full">
	<Tabs tabStyle="underline" class="w-full justify-center">
		<TabItem open>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<PlayOutline size="md" />
					Spiele
				</div>
			{/snippet}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				<b>Spiele:</b>
				Hier werden die Spiele angezeigt.
			</p>
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<ChartOutline size="md" />
					Statistiken
				</div>
			{/snippet}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				<b>Statistiken:</b>
				Hier werden die Statistiken angezeigt.
			</p>
		</TabItem>

		<TabItem>
			{#snippet titleSlot()}
				<div class="flex items-center gap-2">
					<UsersGroupSolid size="md" />
					Spieler
				</div>
			{/snippet}
			<p class="text-sm text-gray-500 dark:text-gray-400">
				<b>Spieler:</b>
				Hier werden die Spieler angezeigt.
			</p>
		</TabItem>
	</Tabs>
</div>


