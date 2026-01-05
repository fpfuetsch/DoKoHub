<script lang="ts">
	import { Game } from '$lib/domain/game';
	import { formatDateTime } from '$lib/utils/format';
	import { Button, Tabs, TabItem, Dropdown, DropdownItem, Modal, Alert } from 'flowbite-svelte';
	import {
		ArrowLeftOutline,
		OrderedListOutline,
		ChartOutline,
		DotsVerticalOutline,
		ExclamationCircleSolid,
		StopSolid,
		TrashBinSolid
	} from 'flowbite-svelte-icons';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

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

	const roundProgress = $derived(
		game
			? game.isFinished()
				? 'Spiel abgeschlossen'
				: `Runde ${game.getRoundCount()} / ${game.maxRoundCount}`
			: ''
	);

	let finishModal = $state(false);
	let deleteModal = $state(false);
	let deleteCounter = $state(10);
	let deleteEnabled = $state(false);

	const handleFinishGame: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await goto(`/groups/${groupId}/games`);
			}
		};
	};

	const handleDeleteGame: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await goto(`/groups/${groupId}/games`);
			}
		};
	};

	$effect(() => {
		if (deleteModal) {
			deleteCounter = 10;
			deleteEnabled = false;
			setTimeout(function tick() {
				deleteCounter--;
				if (deleteCounter > 0) {
					setTimeout(tick, 1000);
				} else {
					deleteEnabled = true;
				}
			}, 1000);
		}
	});
</script>

<header class="bg-white shadow-sm">
	<div class="top-0 z-30 flex h-14 items-center px-2">
		<Button
			color="light"
			size="sm"
			class="flex h-10 w-10 items-center justify-center "
			pill={true}
			onclick={() => goto(`/groups/${groupId}/games`)}
			aria-label="Zurück"
		>
			<ArrowLeftOutline class="h-6 w-6" />
		</Button>
		<h1 class="flex-1 truncate text-center text-2xl font-semibold text-primary">
			{roundProgress}
		</h1>
		<Button
			color="light"
			size="sm"
			class="flex h-10 w-10 items-center justify-center"
			pill={true}
			aria-label="Spielmenü"
		>
			<DotsVerticalOutline class="h-6 w-6" id="game-menu" />
		</Button>
		<Dropdown simple triggeredBy="#game-menu">
			{#if !game?.isFinished()}
				<DropdownItem onclick={() => (finishModal = true)} class="list-none">
					<div class="flex items-center gap-2">
						<StopSolid class="h-4 w-4" />
						<span>Spiel beenden</span>
					</div>
				</DropdownItem>
			{/if}
			<DropdownItem onclick={() => (deleteModal = true)} class="list-none">
				<div class="flex items-center gap-2">
					<TrashBinSolid class="h-4 w-4" />
					<span>Spiel löschen</span>
				</div>
			</DropdownItem>
		</Dropdown>
	</div>

	<!-- Tab Navigation -->
	<div class="top-14 z-20">
		<Tabs
			tabStyle="underline"
			classes={{ content: 'hidden' }}
			divider={false}
			class="flex justify-center"
		>
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

<Modal bind:open={finishModal} size="xs" autoclose={false}>
	<form
		method="POST"
		action="/groups/{groupId}/games/{gameId}?/finishEarly"
		use:enhance={handleFinishGame}
	>
		<div class="flex flex-col space-y-4">
			<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spiel vorzeitig beenden?</h3>

			<Alert color="yellow">
				{#snippet icon()}
					<ExclamationCircleSolid class="h-5 w-5" />
				{/snippet}
				<span class="font-medium">Warnung:</span>
				<div>Das Spiel wird sofort beendet und kann nicht mehr bearbeitet werden.</div>
			</Alert>

			<div class="flex justify-end gap-3">
				<Button type="button" color="light" onclick={() => (finishModal = false)}>Abbrechen</Button>
				<Button type="submit">Spiel beenden</Button>
			</div>
		</div>
	</form>
</Modal>

<Modal bind:open={deleteModal} size="xs" autoclose={false}>
	<form
		method="POST"
		action="/groups/{groupId}/games/{gameId}?/delete"
		use:enhance={handleDeleteGame}
	>
		<div class="flex flex-col space-y-4">
			<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spiel löschen</h3>

			<Alert color="red">
				{#snippet icon()}
					<ExclamationCircleSolid class="h-5 w-5" />
				{/snippet}
				<span class="font-medium">Warnung:</span>
				<div>
					Das Spiel vom <strong>{game ? formatDateTime(game.createdAt) : ''}</strong> wird dauerhaft gelöscht
					und kann nicht wiederhergestellt werden.
				</div>
			</Alert>

			<div class="flex justify-end gap-3">
				<Button type="button" color="light" onclick={() => (deleteModal = false)}>Abbrechen</Button>
				<Button type="submit" disabled={!deleteEnabled}>
					{deleteEnabled ? 'Spiel löschen' : `Spiel löschen (${deleteCounter})`}
				</Button>
			</div>
		</div>
	</form>
</Modal>
