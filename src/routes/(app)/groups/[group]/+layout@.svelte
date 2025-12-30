<script lang="ts">
	import { Group } from '$lib/domain/group';
	import { Button, Tabs, TabItem } from 'flowbite-svelte';
	import {
		ArrowLeftOutline,
		PlayOutline,
		ChartOutline,
		UsersGroupSolid
	} from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data, children } = $props();

	const group: Group | null = $derived(data.group);
	const groupId = $derived($page.params.group);

	const tabs = [
		{ name: 'games', label: 'Spiele', icon: PlayOutline },
		{ name: 'statistics', label: 'Statistiken', icon: ChartOutline },
		{ name: 'players', label: 'Spieler', icon: UsersGroupSolid }
	];

	const currentTab = $derived.by(() => {
		const pathParts = $page.url.pathname.split('/');
		return pathParts[pathParts.length - 1] || 'games';
	});

	let selected = $state(currentTab);

	$effect(() => {
		selected = currentTab;
	});
</script>

<header class="bg-primary-200 shadow-sm">
	<div class="sticky top-0 z-30 flex h-14 items-center px-2">
		<Button
			color="primary-200"
			size="sm"
			class="flex h-10 w-10 items-center justify-center cursor-pointer"
			pill={true}
			onclick={() => goto('/groups')}
			aria-label="Zurück"
		>
			<ArrowLeftOutline class="h-6 w-6" />
		</Button>
		<div class="flex-1 truncate text-center text-2xl font-semibold">
			{group ? group.name : ''}
		</div>
		<div class="h-10 w-10"></div>
		<!-- Spacer for symmetry -->
	</div>

	<!-- Tab Navigation -->
	<div class="sticky top-14 z-20">
		<Tabs tabStyle="underline" classes={{ content: "hidden" }} divider={false} bind:selected class="flex justify-center">
			{#each tabs as tab}
				<TabItem key={tab.name} onclick={() => goto(`/groups/${groupId}/${tab.name}`)}>
					{#snippet titleSlot()}
						<div class="flex items-center gap-2">
							<tab.icon size="md" />
							{tab.label}
						</div>
					{/snippet}
				</TabItem>
			{/each}
		</Tabs>
	</div>
</header>

<div class="w-full">
	{@render children()}
</div>
