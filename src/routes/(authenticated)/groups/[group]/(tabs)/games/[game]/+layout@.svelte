<script lang="ts">
	import { Game } from '$lib/domain/game';
	import { formatDateTime } from '$lib/utils/format';
	import { Button, Tabs, TabItem } from 'flowbite-svelte';
	import { ArrowLeftOutline, OrderedListOutline, ChartOutline } from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data, children }: { data: { game?: Game }; children: () => any } = $props();

	const game: Game | null = $derived(data.game ?? null);
	const groupId = $derived($page.params.group);
	const gameId = $derived($page.params.game);

	const tabs = [
		{ name: 'rounds', label: 'Runden', icon: OrderedListOutline },
		{ name: 'statistics', label: 'Statistiken', icon: ChartOutline }
	];

	const pathParts = $page.url.pathname.split('/').filter(Boolean);
	const initialTab = pathParts[pathParts.length - 1] || 'rounds';
	let selected = $state(initialTab);

	$effect(() => {
		const currentTab = $page.url.pathname.split('/').filter(Boolean).at(-1) || 'rounds';
		if (selected !== currentTab) {
			selected = currentTab;
		}
	});

	const gameTitle = $derived(game ? formatDateTime(game.createdAt) : '');
	const roundProgress = $derived(
		game
			? game.isFinished()
				? 'Spiel abgeschlossen'
				: `${game.getRoundCount()} / ${game.maxRoundCount} Runden`
			: ''
	);
</script>

<header class="bg-primary-300 shadow-sm">
	<div class="top-0 z-30 flex h-14 items-center px-2">
		<Button
			color="primary-300"
			size="sm"
			class="flex h-10 w-10 items-center justify-center "
			pill={true}
			onclick={() => goto(`/groups/${groupId}/games`)}
			aria-label="Zurück"
		>
			<ArrowLeftOutline class="h-6 w-6" />
		</Button>
		<h1 class="flex-1 truncate text-center text-2xl font-semibold">
			{roundProgress}
		</h1>
		<div class="h-10 w-10"></div>
		<!-- Spacer for symmetry -->
	</div>

	<!-- Tab Navigation -->
	<div class="top-14 z-20">
		<Tabs tabStyle="underline" classes={{ content: 'hidden' }} divider={false} class="flex justify-center">
			{#each tabs as tab}
				<TabItem
					open={selected === tab.name}
					onclick={() => {
						selected = tab.name;
						goto(`/groups/${groupId}/games/${gameId}/${tab.name}`);
					}}
				>
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
