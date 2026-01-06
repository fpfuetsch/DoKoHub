<script lang="ts">
	import { Button, Modal, Label, Alert, Select, Toggle, ButtonGroup } from 'flowbite-svelte';
	import {
		PlusOutline,
		ExclamationCircleSolid,
		CheckCircleSolid,
		InfoCircleSolid,
		ShuffleOutline,
		RefreshOutline
	} from 'flowbite-svelte-icons';
	import { Game } from '$lib/domain/game';
	import { formatDateTime } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form }: PageProps = $props();
	const games: Game[] = $derived(data.games ?? []);
	const group = $derived(data.group);
	const groupPlayers = $derived(group?.players ?? []);
	const canCreateGame = $derived(groupPlayers.length >= 4);
	let gameModal = $state(false);
	let withMandatorySolos = $state(false);
	let selectedPlayers = $state<(string | null)[]>([null, null, null, null]);
	let maxRoundCount = $state<8 | 12 | 16 | 20 | 24>(16);

	const roundOptions: Array<{ value: 8 | 12 | 16 | 20 | 24; label: number }> = [
		{ value: 8, label: 8 },
		{ value: 12, label: 12 },
		{ value: 16, label: 16 },
		{ value: 20, label: 20 },
		{ value: 24, label: 24 }
	];

	const handleGameSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
				gameModal = false;
				withMandatorySolos = false;
				selectedPlayers = [null, null, null, null];
				maxRoundCount = 16;
			}
			await applyAction(result);
		};
	};

	const randomizeSeats = () => {
		const shuffled = [...groupPlayers].sort(() => Math.random() - 0.5);
		selectedPlayers = shuffled.slice(0, 4).map((p) => p.id);
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
					<div class="flex-1 space-y-1 font-medium dark:text-white">
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
				Wähle aus, ob du mit oder ohne Pflichtsoli spielen möchtest. Anschließend kannst du Spieler
				und deren Sitzreihenfolge anpassen.
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
				<Label for="pflichtsoli" class="font-medium">Mit Pflichtsoli</Label>
				<Toggle id="pflichtsoli" bind:checked={withMandatorySolos} class="cursor-pointer" />
				<input type="hidden" name="withMandatorySolos" value={withMandatorySolos} />
			</div>

			<div class="space-y-2">
				<Label class="mb-2">
					<span>Anzahl der Spielrunden (inkl. Pflichtsoli)</span>
				</Label>
				<input type="hidden" name="maxRoundCount" value={maxRoundCount} />
				<ButtonGroup class="w-full">
					{#each roundOptions as option}
						<Button
							color={maxRoundCount === option.value ? 'primary' : 'alternative'}
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
					<div class="text-sm font-medium text-gray-900">Spieler uns Sitzposition auswählen</div>
					<Button
						pill={true}
						color="primary"
						onclick={randomizeSeats}
						title="Spieler zufällig zuweisen"
					>
						<ShuffleOutline class="h-4 w-4" />
					</Button>
				</div>
				<p class="text-xs text-gray-500">Gib die Sitzposition im Uhrzeigersinn an.</p>
				{#each [0, 1, 2, 3] as position}
					<Label class="space-y-2">
						<span>Sitzposition {position + 1}</span>
						<Select bind:value={selectedPlayers[position]} name="player_{position}" required>
							<option value={null}>Wähle einen Spieler</option>
							{#each groupPlayers as player}
								<option
									value={player.id}
									disabled={selectedPlayers.includes(player.id) &&
										selectedPlayers[position] !== player.id}
								>
									{player.displayName}
								</option>
							{/each}
						</Select>
					</Label>
				{/each}
			</div>
			<div class="flex justify-end gap-3">
				<Button type="submit" value="create">Erstellen</Button>
			</div>
		</div>
	</form>
</Modal>
