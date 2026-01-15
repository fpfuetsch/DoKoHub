<script lang="ts">
	import { Button, Modal, Label, Alert, Toggle, ButtonGroup, Avatar } from 'flowbite-svelte';
	import {
		PlusOutline,
		ExclamationCircleSolid,
		CheckCircleSolid,
		InfoCircleSolid,
		ShuffleOutline,
		RefreshOutline,
		BarsOutline
	} from 'flowbite-svelte-icons';
	import { Game } from '$lib/domain/game';
	import { formatDateTime } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Player } from '$lib/domain/player';

	let { data, form }: PageProps = $props();
	const games: Game[] = $derived(data.games ?? []);
	const group = $derived(data.group);
	const groupPlayers = $derived(group?.players ?? []);
	const canCreateGame = $derived(groupPlayers.length >= 4);
	let gameModal = $state(false);
	let withMandatorySolos = $state(false);
	let isFivePlayer = $state(false);
	let sortedPlayers = $state<Player[]>([]);
	let maxRoundCount = $state<8 | 12 | 16 | 20 | 24 | 10 | 15 | 25 | 30>(16);

	// When 5-player mode is toggled, update the default round count
	$effect(() => {
		if (isFivePlayer && ![10, 15, 20, 25, 30].includes(maxRoundCount as any)) {
			// keep positions proportional
			maxRoundCount = Math.round(((maxRoundCount as number) / 4) * 5) as 10 | 15 | 20 | 25 | 30;
		} else if (!isFivePlayer && ![8, 12, 16, 20, 24].includes(maxRoundCount as any)) {
			maxRoundCount = Math.round(((maxRoundCount as number) / 5) * 4) as 8 | 12 | 16 | 20 | 24;
		}
	});

	const triggerHaptic = () => {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			navigator.vibrate?.(20);
		}
	};

	// Drag and drop state
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	const roundOptions4P: Array<{ value: 8 | 12 | 16 | 20 | 24; label: number }> = [
		{ value: 8, label: 8 },
		{ value: 12, label: 12 },
		{ value: 16, label: 16 },
		{ value: 20, label: 20 },
		{ value: 24, label: 24 }
	];

	const roundOptions5P: Array<{ value: 10 | 15 | 20 | 25 | 30; label: number }> = [
		{ value: 10, label: 10 },
		{ value: 15, label: 15 },
		{ value: 20, label: 20 },
		{ value: 25, label: 25 },
		{ value: 30, label: 30 }
	];

	const roundOptions = $derived(isFivePlayer ? roundOptions5P : roundOptions4P);

	$effect(() => {
		if (gameModal && sortedPlayers.length === 0) {
			sortedPlayers = [...groupPlayers];
		}
	});

	const handleGameSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				const newGameId = result.data?.gameId;
				if (newGameId) {
					// navigate directly to the new game's rounds using SvelteKit navigation
					await goto(`/groups/${data.group?.id}/games/${newGameId}/rounds`);
					return;
				}
				await invalidateAll();
				gameModal = false;
				withMandatorySolos = false;
				isFivePlayer = false;
				sortedPlayers = [];
				maxRoundCount = 16;
			}
			await applyAction(result);
		};
	};

	const randomizeSeats = () => {
		const shuffled = [...groupPlayers].sort(() => Math.random() - 0.5);
		sortedPlayers = shuffled;
	};

	const reorderPlayers = (fromIndex: number, toIndex: number) => {
		if (fromIndex === toIndex) return;
		const newList = [...sortedPlayers];
		const [movedPlayer] = newList.splice(fromIndex, 1);
		newList.splice(toIndex, 0, movedPlayer);
		sortedPlayers = newList;
	};

	const resetDragState = () => {
		draggedIndex = null;
		dragOverIndex = null;
	};

	// Desktop drag and drop handlers
	const handleDragStart = (e: DragEvent, index: number) => {
		draggedIndex = index;
		dragOverIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			// Use the entire row as the drag image and align it to the
			// exact mouse position within the row so it doesn't trail
			const target = e.target as HTMLElement | null;
			const row = target?.closest('[data-player-index]') as HTMLElement | null;
			if (row) {
				const rect = row.getBoundingClientRect();
				const offsetX = e.clientX - rect.left;
				const offsetY = e.clientY - rect.top;
				e.dataTransfer.setDragImage(row, offsetX, offsetY);
			}
		}
	};

	const handleDragOver = (e: DragEvent, index: number) => {
		e.preventDefault();
		dragOverIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
	};

	const handleDrop = (e: DragEvent, targetIndex: number) => {
		e.preventDefault();
		if (draggedIndex !== null) {
			reorderPlayers(draggedIndex, targetIndex);
		}
		resetDragState();
	};

	const handleDragEnd = () => {
		resetDragState();
	};

	// Mobile touch handlers
	const handleTouchStart = (e: TouchEvent, index: number) => {
		draggedIndex = index;
		dragOverIndex = index;
		triggerHaptic();
	};

	const handleTouchMove = (e: TouchEvent) => {
		if (draggedIndex === null) return;
		e.stopPropagation();

		const touch = e.touches[0];
		const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
		const playerItem = element?.closest('[data-player-index]');

		if (playerItem) {
			const targetIndex = parseInt(playerItem.getAttribute('data-player-index') || '0', 10);
			dragOverIndex = targetIndex;
		}
	};

	const handleTouchEnd = () => {
		if (draggedIndex !== null && dragOverIndex !== null) {
			reorderPlayers(draggedIndex, dragOverIndex);
		}
		triggerHaptic();
		resetDragState();
	};
</script>

<div class="flex flex-col items-center gap-4">
	{#if !canCreateGame}
		<Alert color="secondary" class="w-full max-w-xl">
			{#snippet icon()}
				<ExclamationCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Mindestens 4 Spieler benötigt.</span>
			<div>Um ein Spiel zu erstellen, müssen mindestens 4 Spieler in der Gruppe sein.</div>
		</Alert>
	{/if}
	{#if games.length === 0}
		{#if canCreateGame}
			<Alert color="secondary" class="w-full max-w-xl">
				{#snippet icon()}
					<InfoCircleSolid class="h-5 w-5" />
				{/snippet}
				<span class="font-medium">Es wurden noch keine Spiele erstellt.</span>
				<div>Erstelle ein neues Spiel über den Button unten rechts.</div>
			</Alert>
		{/if}
	{:else}
		<ul class="w-full max-w-xl space-y-2">
			{#each games as game}
				<a
					href="/groups/{group.id}/games/{game.id}/rounds"
					class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
				>
					<div class="flex-1 space-y-1 dark:text-white">
						<div class="font-semibold text-gray-900 dark:text-white">
							{formatDateTime(game.createdAt)}
						</div>
						<div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
							{#if groupPlayers.length > 4}
								<div>
									<span class="font-medium">Spieler:</span>
									{#if game.participants.length === 0}
										<span class="italic">Keine Spieler hinzugefügt</span>
									{:else}
										<span
											>{game.participants
												.map((p) => p.player?.displayName ?? 'Unbekannt')
												.join(', ')}</span
										>
									{/if}
								</div>
							{/if}
							<div>
								<span class="font-medium">Spielrunden:</span>
								<span>{game.maxRoundCount}</span>
							</div>
							<div>
								<span class="font-medium">Pflichtsoli:</span>
								<span>{game.withMandatorySolos ? 'Ja' : 'Nein'}</span>
							</div>
						</div>
					</div>
					<div class="flex flex-col items-end gap-2">
						{#if game.endedAt}
							<div class="flex items-center gap-1 text-sm text-green-600">
								<CheckCircleSolid class="h-4 w-4" />
								<span>Beendet</span>
							</div>
						{:else}
							<div class="flex items-center gap-1 text-sm text-secondary-600">
								<RefreshOutline class="h-4 w-4" />
								<span>Läuft noch</span>
							</div>
						{/if}
					</div>
				</a>
			{/each}
		</ul>
	{/if}
</div>

<Button
	pill={false}
	class="fixed right-6 bottom-6 z-50 rounded-2xl p-2 shadow-lg"
	disabled={!canCreateGame}
	onclick={() => (gameModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={gameModal} size="xs" autoclose={false}>
	<form method="POST" action="?/create" use:enhance={handleGameSubmit}>
		<div class="flex flex-col space-y-6">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				Erstelle ein neues Spiel
			</h3>
			<p class="text-sm text-gray-600">
				Wähle aus, ob du mit oder ohne Pflichtsoli und mit einem extra Spieler spielen möchtest.
				Anschließend kannst du Spieler und deren Sitzreihenfolge anpassen.
			</p>
			{#if form?.error}
				<Alert color="red">
					{#snippet icon()}
						<ExclamationCircleSolid class="h-5 w-5" />
					{/snippet}
					<span class="font-medium">Fehler beim Erstellen</span>
					<div>{form.error}</div>
				</Alert>
			{/if}

			<div class="flex items-center justify-between">
				<Label for="pflichtsoli" class="font-medium">Pflichtsoli</Label>
				<Toggle
					id="pflichtsoli"
					bind:checked={withMandatorySolos}
					class="cursor-pointer"
					color="secondary"
				/>
				<input type="hidden" name="withMandatorySolos" value={withMandatorySolos} />
			</div>

			<div class="flex items-center justify-between">
				<Label for="fivePlayer" class="font-medium">5 Spieler (Geber setzt aus)</Label>
				<Toggle
					id="fivePlayer"
					bind:checked={isFivePlayer}
					disabled={groupPlayers.length === 4}
					class="cursor-pointer"
					color="secondary"
				/>
			</div>

			<div class="space-y-2">
				<Label class="mb-2">
					<span>Anzahl der Spielrunden (inkl. Pflichtsoli)</span>
				</Label>
				<input type="hidden" name="maxRoundCount" value={maxRoundCount} />
				<ButtonGroup class="w-full">
					{#each roundOptions as option}
						<Button
							color={maxRoundCount === option.value ? 'secondary' : 'light'}
							class="flex-1 "
							onclick={() => (maxRoundCount = option.value)}
						>
							{option.label}
						</Button>
					{/each}
				</ButtonGroup>
			</div>

			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<div class="text-sm font-medium text-gray-900 dark:text-white">
						Spieler und Sitzposition auswählen
					</div>
					<Button
						pill={true}
						color="secondary"
						onclick={randomizeSeats}
						title="Spieler zufällig zuweisen"
					>
						<ShuffleOutline class="h-4 w-4" />
					</Button>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Verschiebe die Spieler, um deren Sitzposition <strong>im Uhrzeigersinn</strong> auszuwählen.
				</p>

				{#each [0, 1, 2, 3] as position}
					<input type="hidden" name="player_{position}" value={sortedPlayers[position]?.id ?? ''} />
				{/each}
				{#if isFivePlayer && sortedPlayers[4]}
					<input type="hidden" name="player_4" value={sortedPlayers[4]?.id ?? ''} />
				{/if}

				<div class="space-y-2">
					{#each sortedPlayers as player, index (player.id)}
						{@const maxSeats = isFivePlayer ? 5 : 4}
						{#if index === maxSeats && index > 0}
							<div class="relative my-2">
								<div class="absolute inset-0 flex items-center">
									<div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
								</div>
								<div class="relative flex justify-center text-xs">
									<span class="bg-white px-2 text-gray-500 dark:bg-gray-900 dark:text-gray-400"
										>Nicht ausgewählt</span
									>
								</div>
							</div>
						{/if}
						<div
							data-player-index={index}
							class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 select-none dark:border-gray-700 dark:bg-gray-800 {draggedIndex ===
							index
								? 'opacity-50 ring-2 ring-secondary'
								: dragOverIndex === index && draggedIndex !== null
									? 'bg-secondary/10 ring-2 ring-secondary'
									: ''}"
							style="transition: opacity 0.15s ease, box-shadow 0.15s ease;"
							role="listitem"
							ondragover={(e) => handleDragOver(e, index)}
							ondrop={(e) => handleDrop(e, index)}
						>
							<Avatar class="shrink-0 bg-secondary text-white">
								{player.displayName.charAt(0).toUpperCase()}
							</Avatar>
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium text-gray-900 dark:text-white">
									{player.displayName}
								</div>
								{#if index < maxSeats}
									<div class="text-xs text-gray-500 dark:text-gray-400">
										Sitzposition {index + 1}
									</div>
								{/if}
							</div>
							<div
								class="shrink-0 cursor-grab touch-none text-gray-400 active:cursor-grabbing dark:text-gray-500"
								aria-label="Sitzposition verschieben"
								title="Zum Verschieben ziehen"
								role="button"
								tabindex="0"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, index)}
								ondragend={handleDragEnd}
								ontouchstart={(e) => handleTouchStart(e, index)}
								ontouchmove={handleTouchMove}
								ontouchend={handleTouchEnd}
							>
								<BarsOutline class="h-6 w-6" />
							</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<Button type="submit" value="create">Erstellen</Button>
			</div>
		</div>
	</form>
</Modal>
