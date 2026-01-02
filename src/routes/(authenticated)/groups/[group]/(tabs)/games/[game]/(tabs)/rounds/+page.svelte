<script lang="ts">
	import { Button, Modal, Label, Alert, ButtonGroup, Toggle } from 'flowbite-svelte';
	import { PlusOutline, ExclamationCircleSolid, EditOutline, MinusOutline } from 'flowbite-svelte-icons';
	import { Game } from '$lib/domain/game';
	import type { PageProps } from './$types';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, form }: PageProps = $props();
	const game: Game = $derived(data.game);

	// Get sorted participants by seat position
	const sortedParticipants = $derived(
		[...game.participants].sort((a, b) => a.seatPosition - b.seatPosition)
	);

	let roundModal = $state(false);
	let roundType = $state<string>('NORMAL');
	let soloType = $state<'PFLICHT' | 'LUST' | null>(null);
	let soloTypeSelection = $state<string | null>(null);
	let eyesReInput = $state(120);
	let eyesTeam = $state<'RE' | 'KONTRA'>('RE');
	let eyesError = $state<string | null>(null);
	let playerTeams = $state<Record<string, 'RE' | 'KONTRA' | undefined>>({});
	const bonusesAllowed = $derived(roundType === 'NORMAL' || roundType === 'HOCHZEIT_NORMAL');

	// Player calls and bonus points
	let playerCalls = $state<Record<string, {
		calls: { team: 'RE' | 'KONTRA' | null; type: 'KEINE90' | 'KEINE60' | 'KEINE30' | 'SCHWARZ' | null };
		bonus: { fuchs: number; doppelkopf: number; karlchen: boolean };
	}>>({});
	let callsEditModal = $state(false);
	let bonusEditModal = $state(false);
	let editingPlayerId = $state<string | null>(null);

	// Initialize player teams when modal opens
	$effect(() => {
		if (roundModal && Object.keys(playerTeams).length === 0) {
			const teams: Record<string, 'RE' | 'KONTRA' | undefined> = {};
			const calls: Record<string, {
				calls: { team: 'RE' | 'KONTRA' | null; type: 'KEINE90' | 'KEINE60' | 'KEINE30' | 'SCHWARZ' | null };
				bonus: { fuchs: number; doppelkopf: number; karlchen: boolean };
			}> = {};
			sortedParticipants.forEach((p) => {
				teams[p.playerId] = undefined;
				calls[p.playerId] = {
					calls: { team: null, type: null },
					bonus: { fuchs: 0, doppelkopf: 0, karlchen: false }
				};
			});
			playerTeams = teams;
			playerCalls = calls;
		}
	});

	$effect(() => {
		if (!bonusesAllowed) {
			const hasAnyBonus = Object.values(playerCalls).some(
				(entry) => entry.bonus.fuchs !== 0 || entry.bonus.doppelkopf !== 0 || entry.bonus.karlchen
			);
			if (hasAnyBonus) {
				playerCalls = Object.fromEntries(
					Object.entries(playerCalls).map(([playerId, data]) => [
						playerId,
						{ ...data, bonus: { fuchs: 0, doppelkopf: 0, karlchen: false } }
					])
				);
				bonusEditModal = false;
				editingPlayerId = null;
			}
		}
	});

	// Validate eyes input
	const handleEyesInput = (input: number) => {
		if (input < 0 || input > 240) {
			eyesError = 'Augensumme muss zwischen 0 und 240 liegen';
			eyesReInput = Math.max(0, Math.min(240, input));
		} else {
			eyesError = null;
			eyesReInput = input;
		}
	};

	const handleRoundSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
				roundModal = false;
				// Reset form
				roundType = 'NORMAL';
				soloType = null;
				soloTypeSelection = null;
				eyesReInput = 120;
				eyesTeam = 'RE';
				eyesError = null;
				playerTeams = {};
			}
			await applyAction(result);
		};
	};

	const togglePlayerTeam = (playerId: string) => {
		const current = playerTeams[playerId];
		if (current === undefined) {
			playerTeams[playerId] = 'RE';
		} else if (current === 'RE') {
			playerTeams[playerId] = 'KONTRA';
		} else {
			playerTeams[playerId] = undefined;
		}
	};

	// Get the final round type based on selections
	const getFinalRoundType = (): string => {
		if (roundType === 'NORMAL') return 'NORMAL';
		if (roundType.startsWith('HOCHZEIT')) return roundType;
		if (roundType.startsWith('SOLO') && soloTypeSelection) {
			return `SOLO_${soloTypeSelection}`;
		}
		return roundType;
	};
</script>

	<div class="p-6 flex flex-col gap- min-h-screen bg-gray-50 dark:bg-gray-900">
	{#if game.rounds.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
			<p class="text-lg mb-4">Noch keine Runden hinzugefügt.</p>
			<p class="text-sm">Klicke auf den Plus-Button unten rechts, um die erste Runde hinzuzufügen.</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full border-collapse bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
				<thead>
					<tr class="border-b border-gray-200 dark:border-gray-700">
						<th class="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700">
							Runde
						</th>
						{#each sortedParticipants as participant}
							<th class="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700">
								{participant.player?.displayName ?? 'Spieler'}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each game.rounds as round, roundIndex (round.id)}
						<tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
								{round.roundNumber}
							</td>
							{#each sortedParticipants as participant}
								{@const roundParticipant = round.participants.find((p) => p.playerId === participant.playerId)}
								<td class="px-4 py-2 text-center">
									<div class="flex flex-col gap-1">
										<div class="text-xs font-semibold px-2 py-1 rounded {roundParticipant?.team === 'RE'
											? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100'
											: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100'}">
											{roundParticipant?.team === 'RE' ? 'RE' : 'KONTRA'}
										</div>
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Button
	pill={true}
	class="fixed right-6 bottom-6 z-50 p-2"
	onclick={() => (roundModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={roundModal} fullscreen size="lg" autoclose={false} class="p-2 *:border-0!">
	<form method="POST" action="?/addRound" use:enhance={handleRoundSubmit}>
		<div class="flex flex-col space-y-2">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				Füge eine neue Runde hinzu
			</h3>

			<!-- Section 1: Game Type Selection -->
			<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
				<Label class="text-sm font-semibold text-gray-900 dark:text-white">Spielvariante</Label>

				<div class="space-y-3 mt-3">
					<div>
						<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Grundvariante</Label>
						<ButtonGroup class="w-full">
							<Button
								type="button"
								color={roundType === 'NORMAL' ? 'secondary' : 'light'}
								class="flex-1 "
								onclick={() => {
									roundType = 'NORMAL';
									soloType = null;
									soloTypeSelection = null;
								}}
							>
								Normal
							</Button>
							<Button
								type="button"
								color={roundType.startsWith('HOCHZEIT') ? 'secondary' : 'light'}
								class="flex-1 "
								onclick={() => {
									roundType = 'HOCHZEIT_NORMAL';
									soloType = null;
									soloTypeSelection = null;
								}}
							>
								Hochzeit
							</Button>
							<Button
								type="button"
								color={roundType.startsWith('SOLO') ? 'secondary' : 'light'}
								class="flex-1 "
								onclick={() => {
									roundType = 'SOLO_BUBEN';
									soloType = 'PFLICHT';
									soloTypeSelection = 'BUBEN';
								}}
							>
								Solo
							</Button>
						</ButtonGroup>
					</div>

					{#if roundType.startsWith('HOCHZEIT')}
						<div>
							<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Hochzeitvariante</Label>
							<ButtonGroup class="w-full">
								<Button
									type="button"
									color={roundType === 'HOCHZEIT_NORMAL' ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = 'HOCHZEIT_NORMAL')}
								>
									Normal
								</Button>
								<Button
									type="button"
									color={roundType === 'HOCHZEIT_STILL' ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = 'HOCHZEIT_STILL')}
								>
									Still
								</Button>
								<Button
									type="button"
									color={roundType === 'HOCHZEIT_UNGEKLAERT' ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = 'HOCHZEIT_UNGEKLAERT')}
								>
									Ungeklärt
								</Button>
							</ButtonGroup>
						</div>
					{:else if roundType.startsWith('SOLO')}
						<div class="space-y-2">
							<div>
								<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Pflichtsolo / Lustsolo</Label>
								<ButtonGroup class="w-full">
									<Button
										type="button"
										color={soloType === 'PFLICHT' ? 'secondary' : 'light'}
										class="flex-1 "
										onclick={() => (soloType = 'PFLICHT')}
									>
										Pflicht
									</Button>
									<Button
										type="button"
										color={soloType === 'LUST' ? 'secondary' : 'light'}
										class="flex-1 "
										onclick={() => (soloType = 'LUST')}
									>
										Lust
									</Button>
								</ButtonGroup>
							</div>

							<div>
								<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Solotyp</Label>
								<ButtonGroup class="w-full">
									<Button
										type="button"
										color={soloTypeSelection === 'BUBEN' ? 'secondary' : 'light'}
										class="flex-1  text-xs py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'BUBEN';
											roundType = 'SOLO_BUBEN';
										}}
									>
										Bube
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'DAMEN' ? 'secondary' : 'light'}
										class="flex-1  text-xs py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'DAMEN';
											roundType = 'SOLO_DAMEN';
										}}
									>
										Dame
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'ASS' ? 'secondary' : 'light'}
										class="flex-1  text-xs py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'ASS';
											roundType = 'SOLO_ASS';
										}}
									>
										Ass
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'KREUZ' ? 'secondary' : 'light'}
										class="flex-1  py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'KREUZ';
											roundType = 'SOLO_KREUZ';
										}}
									>
										♣
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'PIK' ? 'secondary' : 'light'}
										class="flex-1  py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'PIK';
											roundType = 'SOLO_PIK';
										}}
									>
										♠
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'HERZ' ? 'secondary' : 'light'}
										class="flex-1  py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'HERZ';
											roundType = 'SOLO_HERZ';
										}}
									>
										♥
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'KARO' ? 'secondary' : 'light'}
										class="flex-1  py-1 px-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'KARO';
											roundType = 'SOLO_KARO';
										}}
									>
										♦
									</Button>
								</ButtonGroup>
							</div>
						</div>
					{/if}
				</div>

				<!-- Hidden input for round type -->
				<input type="hidden" name="type" value={getFinalRoundType()} />
				{#if soloType}
					<input type="hidden" name="soloType" value={soloType} />
				{/if}
			</div>

			<!-- Section 2: Eyes -->
			<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
				<Label class="text-sm font-semibold text-gray-900 dark:text-white">Erreichte Augensumme</Label>
				<div class="space-y-3 mt-3">
					<div>
						<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Team</Label>
						<ButtonGroup class="w-full">
							<Button
								type="button"
								color={eyesTeam === 'RE' ? 'secondary' : 'light'}
								class="flex-1 "
								onclick={() => {
									eyesReInput = 240 - eyesReInput;
									eyesTeam = 'RE';
								}}
							>
								Re
							</Button>
							<Button
								type="button"
								color={eyesTeam === 'KONTRA' ? 'secondary' : 'light'}
								class="flex-1 "
								onclick={() => {
									eyesReInput = 240 - eyesReInput;
									eyesTeam = 'KONTRA';
								}}
							>
								Kontra
							</Button>
						</ButtonGroup>
					</div>

					<div>
						<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">{eyesTeam === 'RE' ? 'Re' : 'Kontra'} Augen</Label>
						<input
							type="number"
							name="eyesRe"
							min="0"
							max="240"
							value={eyesReInput}
							oninput={(e) => handleEyesInput(parseInt(e.currentTarget.value) || 0)}
							class="w-full px-3 py-2 border {eyesError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-semibold focus:outline-none focus:ring-2 {eyesError ? 'focus:ring-red-500' : 'focus:ring-blue-500'} focus:border-transparent"
						/>
						{#if eyesError}
							<div class="text-xs text-red-600 dark:text-red-400 mt-1">{eyesError}</div>
						{:else}
							<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{eyesTeam === 'RE' ? 'Kontra' : 'Re'} Augen: {240 - eyesReInput}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Section 3: Player Teams -->
			<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
				<Label class="text-sm font-semibold text-gray-900 dark:text-white">Spielerteams</Label>
				<p class="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-3">Klicke auf eine Karte um das Team zu wechseln</p>
				<div class="grid grid-cols-2 gap-3">
					{#each sortedParticipants as participant}
						{@const team = playerTeams[participant.playerId]}
						{@const calls = playerCalls[participant.playerId]}
						<div
							class="flex flex-col gap-2 p-3 rounded-lg border-2  transition {team === 'RE'
								? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
								: team === 'KONTRA'
									? 'border-red-500 bg-red-50 dark:bg-red-900/20'
									: 'border-gray-400 bg-gray-100 dark:bg-gray-700'}"
						>
							<button
								type="button"
								onclick={() => togglePlayerTeam(participant.playerId)}
								class="flex flex-col items-center gap-2 transition hover:opacity-80 "
							>
								{#if team}
									<input type="hidden" name="player_{participant.seatPosition}_team" value={team} />
									{#if calls?.calls.team}
										<input type="hidden" name="player_{participant.seatPosition}_call_{calls.calls.team}" value={calls.calls.team} />
									{/if}
									{#if calls?.calls.type}
										<input type="hidden" name="player_{participant.seatPosition}_call_{calls.calls.type}" value={calls.calls.type} />
									{/if}
									{#if bonusesAllowed}
										{#if calls?.bonus.fuchs}
											<input type="hidden" name="player_{participant.seatPosition}_bonus_FUCHS" value={calls.bonus.fuchs} />
										{/if}
										{#if calls?.bonus.doppelkopf}
											<input type="hidden" name="player_{participant.seatPosition}_bonus_DOKO" value={calls.bonus.doppelkopf} />
										{/if}
										{#if calls?.bonus.karlchen}
											<input type="hidden" name="player_{participant.seatPosition}_bonus_KARLCHEN" value={1} />
										{/if}
									{/if}
								{/if}
								<div class="text-sm font-medium text-gray-900 dark:text-white text-center">
									{participant.player?.displayName ?? 'Spieler'}
								</div>
								{#if team}
									<div class={`text-xs font-semibold px-2 py-1 rounded ${
										team === 'RE'
											? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
											: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
									}`}>
										{team}
									</div>
								{:else}
									<div class="text-xs font-semibold px-2 py-1 rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
										Nicht ausgewählt
									</div>
								{/if}
							</button>

							<div class="border-t {team === 'RE'
								? 'border-blue-300 dark:border-blue-700 pt-2'
								: team === 'KONTRA'
									? 'border-red-300 dark:border-red-700 pt-2'
									: 'border-gray-300 dark:border-gray-600 pt-2'} space-y-3">
								<!-- An- und Absagen Section -->
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-xs font-medium text-gray-700 dark:text-gray-300">An/Absagen:</span>
										<Button
											pill
											size="xs"
											color="secondary"
											onclick={() => {
												editingPlayerId = participant.playerId;
												callsEditModal = true;
											}}
											class="p-2!"
											title="Ansagen bearbeiten"
										>
											<EditOutline class="h-4 w-4" />
										</Button>
									</div>
									{#if calls && (calls.calls.team || calls.calls.type)}
										<div class="text-xs text-gray-700 dark:text-gray-300 pl-2">
											{calls.calls.team} {calls.calls.type}
										</div>
									{/if}
								</div>

								<!-- Bonuspunkte Section -->
								{#if bonusesAllowed}
									<div>
										<div class="flex items-center justify-between mb-1">
											<span class="text-xs font-medium text-gray-700 dark:text-gray-300">Bonus:</span>
											<Button
												pill
												size="xs"
												color="secondary"
												onclick={() => {
													editingPlayerId = participant.playerId;
													bonusEditModal = true;
												}}
												class="p-2!"
												title="Bonus bearbeiten"
											>
												<EditOutline class="h-4 w-4" />
											</Button>
										</div>
										{#if calls && (calls.bonus.fuchs !== 0 || calls.bonus.doppelkopf !== 0 || calls.bonus.karlchen)}
											<div class="text-xs text-gray-700 dark:text-gray-300 pl-2">
												{#if calls.bonus.fuchs !== 0}Fuchs {calls.bonus.fuchs}x{/if}{#if calls.bonus.doppelkopf !== 0}{calls.bonus.fuchs !== 0 ? ', ' : ''}Doppelkopf {calls.bonus.doppelkopf}x{/if}{#if calls.bonus.karlchen}{(calls.bonus.fuchs !== 0 || calls.bonus.doppelkopf !== 0) ? ', ' : ''}Karlchen{/if}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			{#if form?.error}
				<Alert color="red" class="mt-2">
					<ExclamationCircleSolid class="h-5 w-5" />
					<span class="font-medium">Validierungsfehler</span>
					<div>{form.error}</div>
				</Alert>
			{/if}

			<div class="flex justify-end gap-3 mt-2">
				<Button
					type="button"
					color="light"

					onclick={() => (roundModal = false)}
				>
					Abbrechen
				</Button>
				<Button type="submit" >Fertig</Button>
			</div>
		</div>
	</form>
</Modal>

<Modal bind:open={callsEditModal} size="xs" autoclose={false}>
	{#if editingPlayerId && playerCalls[editingPlayerId]}
		{@const editingPlayer = sortedParticipants.find((p) => p.playerId === editingPlayerId)}
		{@const playerData = playerCalls[editingPlayerId]}
		<div class="flex flex-col space-y-6">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				{editingPlayer?.player?.displayName} - An/Absagen
			</h3>

			<!-- Calls Section -->
			<div class="space-y-3">
				<div>
					<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Ansage</Label>
					<ButtonGroup class="w-full">
						<Button
							type="button"
							color={playerData.calls.team === 'RE' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.team = playerData.calls.team === 'RE' ? null : 'RE';
							}}
						>
							Re
						</Button>
						<Button
							type="button"
							color={playerData.calls.team === 'KONTRA' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.team = playerData.calls.team === 'KONTRA' ? null : 'KONTRA';
							}}
						>
							Kontra
						</Button>
					</ButtonGroup>
				</div>

				<div>
					<Label class="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Absage</Label>
					<ButtonGroup class="w-full">
						<Button
							type="button"
							color={playerData.calls.type === 'KEINE90' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.type = playerData.calls.type === 'KEINE90' ? null : 'KEINE90';
							}}
						>
							Keine 90
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === 'KEINE60' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.type = playerData.calls.type === 'KEINE60' ? null : 'KEINE60';
							}}
						>
							Keine 60
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === 'KEINE30' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.type = playerData.calls.type === 'KEINE30' ? null : 'KEINE30';
							}}
						>
							Keine 30
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === 'SCHWARZ' ? 'secondary' : 'light'}
							class="flex-1  text-xs py-1"
							onclick={() => {
								playerData.calls.type = playerData.calls.type === 'SCHWARZ' ? null : 'SCHWARZ';
							}}
						>
							Schwarz
						</Button>
					</ButtonGroup>
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-2">
				<Button
					type="button"
					color="primary"

					onclick={() => (callsEditModal = false)}
				>
					Fertig
				</Button>
			</div>
		</div>
	{/if}
</Modal>


<Modal bind:open={bonusEditModal} size="xs" autoclose={false}>
	{#if bonusesAllowed && editingPlayerId && playerCalls[editingPlayerId]}
		{@const editingPlayer = sortedParticipants.find((p) => p.playerId === editingPlayerId)}
		{@const playerData = playerCalls[editingPlayerId]}
		<div class="flex flex-col space-y-6">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				{editingPlayer?.player?.displayName} - Bonuspunkte
			</h3>

			<!-- Bonus Points Section -->
			<div class="space-y-3">
				<!-- Fuchs -->
				<div class="space-y-2">
					<Label class="text-xs text-gray-600 dark:text-gray-400">Fuchs gefangen</Label>
					<div class="flex items-center gap-2">
						<Button
							pill
							color="secondary"
							disabled={playerData.bonus.fuchs <= 0}
							onclick={() => {
								if (playerData.bonus.fuchs > 0) {
									playerData.bonus.fuchs--;
								}
							}}
							class="p-2!"
						>
							<MinusOutline class="h-4 w-4" />
						</Button>
						<span class="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-white">
							{playerData.bonus.fuchs}
						</span>
						<Button
							pill
							color="secondary"
							disabled={playerData.bonus.fuchs >= 2}
							onclick={() => {
								if (playerData.bonus.fuchs < 2) {
									playerData.bonus.fuchs++;
								}
							}}
							class="p-2!"
						>
							<PlusOutline class="h-4 w-4" />
						</Button>
					</div>
				</div>
				<div class="space-y-2">
					<Label class="text-xs text-gray-600 dark:text-gray-400">Doppelkopf</Label>
					<div class="flex items-center gap-2">
						<Button
							pill
							color="secondary"
							disabled={playerData.bonus.doppelkopf <= 0}
							onclick={() => {
								if (playerData.bonus.doppelkopf > 0) {
									playerData.bonus.doppelkopf--;
								}
							}}
							class="p-2!"
						>
							<MinusOutline class="h-4 w-4" />
						</Button>
						<span class="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-white">
							{playerData.bonus.doppelkopf}
						</span>
						<Button
							pill
							color="secondary"
							disabled={playerData.bonus.doppelkopf >= 5}
							onclick={() => {
								if (playerData.bonus.doppelkopf < 5) {
									playerData.bonus.doppelkopf++;
								}
							}}
							class="p-2!"
						>
							<PlusOutline class="h-4 w-4" />
						</Button>
					</div>
				</div>
				<div class="space-y-2">
					<Label class="text-xs text-gray-600 dark:text-gray-400">Karlchen</Label>
					<ButtonGroup class="w-full">
						<Button
							type="button"
							color={playerData.bonus.karlchen === true ? 'secondary' : 'light'}
							class="flex-1 "
							onclick={() => {
								playerData.bonus.karlchen = true;
							}}
						>
							Ja
						</Button>
						<Button
							type="button"
							color={playerData.bonus.karlchen === false ? 'secondary' : 'light'}
							class="flex-1 "
							onclick={() => {
								playerData.bonus.karlchen = false;
							}}
						>
							Nein
						</Button>
					</ButtonGroup>
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-2">
				<Button
					type="button"
					color="primary"
					onclick={() => (bonusEditModal = false)}
				>
					Fertig
				</Button>
			</div>
		</div>
	{/if}
</Modal>
