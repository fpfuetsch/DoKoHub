<script lang="ts">
	import { Modal, Button, Label, Alert, ButtonGroup } from 'flowbite-svelte';
	import { EditOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Game } from '$lib/domain/game';
	import type { GameRoundParticipant } from '$lib/domain/round';
	import type { CallTypeEnumValue, SoloTypeEnumValue, TeamEnumValue } from '$lib/domain/enums';
	import {
		RoundType as RoundTypeEnum,
		SoloType as SoloTypeEnum,
		Team as TeamEnum,
		CallType as CallTypeEnum,
		BonusType as BonusTypeEnum
	} from '$lib/domain/enums';

	export let open: boolean;
	export let isFinished: boolean;
	export let canEditRounds: boolean;
	export let bonusesAllowed: boolean;
	export let game: Game;
	export let remainingMandatorySoloPlayers: {
		playerId: string;
		player?: { displayName?: string };
	}[];
	export let sortedParticipants: {
		playerId: string;
		seatPosition: number;
		player?: { displayName?: string };
	}[];
	export let modalDealerPosition: () => number;
	export let actionForm: { error?: string } | null | undefined;
	export let handleRoundSubmit: SubmitFunction;
	export let onOpenCallsEdit: (playerId: string) => void;
	export let onOpenBonusEdit: (playerId: string) => void;

	export let roundType: string;
	export let soloType: SoloTypeEnumValue | null;
	export let soloTypeSelection: string | null;
	export let eyesInput: number | null;
	export let eyesTeam: TeamEnumValue;
	export let eyesError: string | null;
	export let editingRoundId: string | null;
	export let editingMandatorySolo: boolean;
	export let playerTeams: Record<string, TeamEnumValue | undefined>;
	export let playerCalls: Record<
		string,
		{
			calls: {
				team: TeamEnumValue | null;
				type: CallTypeEnumValue | null;
			};
			bonus: { fuchs: number; doppelkopf: number; karlchen: boolean };
		}
	>;

	let isSubmitting = false;

	$: if (!open) {
		isSubmitting = false;
	}

	const guardedRoundSubmit: SubmitFunction = async (input) => {
		if (isSubmitting) {
			input.cancel();
			return;
		}

		isSubmitting = true;
		const callback = await handleRoundSubmit(input);

		if (!callback) {
			isSubmitting = false;
			return;
		}

		return async (result) => {
			try {
				await callback(result);
			} finally {
				isSubmitting = false;
			}
		};
	};

	const handleEyesInput = (input: number | null) => {
		if (input === null || input === undefined) {
			eyesError = null;
			eyesInput = null;
		} else if (input < 0 || input > 240) {
			eyesError = 'Augensumme muss zwischen 0 und 240 liegen.';
			eyesInput = Math.max(0, Math.min(240, input));
		} else {
			eyesError = null;
			eyesInput = input;
		}
	};

	const togglePlayerTeam = (playerId: string) => {
		const current = playerTeams[playerId];
		if (current === undefined) {
			playerTeams[playerId] = TeamEnum.RE;
		} else if (current === TeamEnum.RE) {
			playerTeams[playerId] = TeamEnum.KONTRA;
		} else {
			playerTeams[playerId] = undefined;
		}
	};
</script>

<Modal bind:open size="sm" autoclose={false} class="p-2 *:border-0!">
	<form method="POST" action="?/save" use:enhance={guardedRoundSubmit}>
		<div class="flex flex-col space-y-2">
			<h3 class="mb-6 text-xl font-medium text-gray-900 dark:text-white">
				{editingRoundId ? (isFinished ? 'Runde ansehen' : 'Runde bearbeiten') : 'Runde hinzufügen'}
			</h3>

			<!-- Section 1: Game Type Selection -->
			<div
				class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<Label class="text-sm font-semibold text-gray-900 dark:text-white">Spielvariante</Label>

				<div class="mt-3 space-y-3">
					<div>
						<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400">Grundvariante</Label>
						<ButtonGroup class="w-full">
							<Button
								type="button"
								color={roundType === RoundTypeEnum.Normal ? 'secondary' : 'light'}
								class={`flex-1 ${!canEditRounds || editingMandatorySolo ? 'cursor-not-allowed opacity-60' : ''}`}
								disabled={!canEditRounds || editingMandatorySolo}
								onclick={() => {
									roundType = RoundTypeEnum.Normal;
									soloType = null;
									soloTypeSelection = null;
								}}
							>
								Normal
							</Button>
							<Button
								type="button"
								color={roundType.startsWith('HOCHZEIT') ? 'secondary' : 'light'}
								class={`flex-1 ${!canEditRounds || editingMandatorySolo ? 'cursor-not-allowed opacity-60' : ''}`}
								disabled={!canEditRounds || editingMandatorySolo}
								onclick={() => {
									roundType = RoundTypeEnum.HochzeitNormal;
									soloType = null;
									soloTypeSelection = null;
								}}
							>
								Hochzeit
							</Button>
							<Button
								type="button"
								color={roundType.startsWith('SOLO') ? 'secondary' : 'light'}
								class={`flex-1 ${!canEditRounds || editingMandatorySolo ? 'cursor-not-allowed opacity-60' : ''}`}
								disabled={!canEditRounds || editingMandatorySolo}
								onclick={() => {
									roundType = RoundTypeEnum.SoloBuben;
									soloType = game.withMandatorySolos
										? remainingMandatorySoloPlayers.length === 0
											? SoloTypeEnum.Lust
											: SoloTypeEnum.Pflicht
										: null;
									soloTypeSelection = 'BUBEN';
								}}
							>
								Solo
							</Button>
						</ButtonGroup>
					</div>

					{#if roundType.startsWith('HOCHZEIT')}
						<div>
							<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400"
								>Hochzeitsvariante</Label
							>
							<ButtonGroup class="w-full">
								<Button
									type="button"
									color={roundType === RoundTypeEnum.HochzeitNormal ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = RoundTypeEnum.HochzeitNormal)}
								>
									Normal
								</Button>
								<Button
									type="button"
									color={roundType === RoundTypeEnum.HochzeitStill ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = RoundTypeEnum.HochzeitStill)}
								>
									Still
								</Button>
								<Button
									type="button"
									color={roundType === RoundTypeEnum.HochzeitUngeklaert ? 'secondary' : 'light'}
									class="flex-1  text-xs"
									onclick={() => (roundType = RoundTypeEnum.HochzeitUngeklaert)}
								>
									Ungeklärt
								</Button>
							</ButtonGroup>
						</div>
					{:else if roundType.startsWith('SOLO')}
						<div class="space-y-2">
							{#if game.withMandatorySolos}
								<div>
									<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400"
										>Pflichtsolo / Lustsolo</Label
									>
									<ButtonGroup class="w-full">
										<Button
											type="button"
											color={soloType === SoloTypeEnum.Pflicht ? 'secondary' : 'light'}
											disabled={!!(
												remainingMandatorySoloPlayers.length === 0 ||
												!canEditRounds ||
												editingMandatorySolo ||
												(editingRoundId && !editingMandatorySolo && roundType.startsWith('SOLO'))
											)}
											class={`flex-1 ${!!(!canEditRounds || editingMandatorySolo || (editingRoundId && !editingMandatorySolo && roundType.startsWith('SOLO'))) ? 'cursor-not-allowed opacity-60' : ''}`}
											onclick={() => (soloType = SoloTypeEnum.Pflicht)}
										>
											Pflicht
										</Button>
										<Button
											type="button"
											color={soloType === SoloTypeEnum.Lust ? 'secondary' : 'light'}
											disabled={editingMandatorySolo || !canEditRounds}
											class={`flex-1 ${editingMandatorySolo || !canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
											onclick={() => {
												if (!editingMandatorySolo) soloType = SoloTypeEnum.Lust;
											}}
										>
											Lust
										</Button>
									</ButtonGroup>
								</div>
							{/if}

							<div>
								<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400">Solotyp</Label>
								<ButtonGroup class="w-full">
									<Button
										type="button"
										color={soloTypeSelection === 'BUBEN' ? 'secondary' : 'light'}
										class={`flex-1  px-1 py-1 text-xs ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
										size="sm"
										disabled={!canEditRounds}
										onclick={() => {
											soloTypeSelection = 'BUBEN';
											roundType = RoundTypeEnum.SoloBuben;
										}}
									>
										Bube
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'DAMEN' ? 'secondary' : 'light'}
										class={`flex-1  px-1 py-1 text-xs ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
										size="sm"
										disabled={!canEditRounds}
										onclick={() => {
											soloTypeSelection = 'DAMEN';
											roundType = RoundTypeEnum.SoloDamen;
										}}
									>
										Dame
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'ASS' ? 'secondary' : 'light'}
										class={`flex-1  px-1 py-1 text-xs ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
										size="sm"
										disabled={!canEditRounds}
										onclick={() => {
											soloTypeSelection = 'ASS';
											roundType = RoundTypeEnum.SoloAss;
										}}
									>
										Ass
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'KREUZ' ? 'secondary' : 'light'}
										class={`flex-1  px-1 py-1 ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
										size="sm"
										disabled={!canEditRounds}
										onclick={() => {
											soloTypeSelection = 'KREUZ';
											roundType = RoundTypeEnum.SoloKreuz;
										}}
									>
										♣
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'PIK' ? 'secondary' : 'light'}
										class="flex-1  px-1 py-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'PIK';
											roundType = RoundTypeEnum.SoloPik;
										}}
									>
										♠
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'HERZ' ? 'secondary' : 'light'}
										class="flex-1  px-1 py-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'HERZ';
											roundType = RoundTypeEnum.SoloHerz;
										}}
									>
										♥
									</Button>
									<Button
										type="button"
										color={soloTypeSelection === 'KARO' ? 'secondary' : 'light'}
										class="flex-1  px-1 py-1"
										size="sm"
										onclick={() => {
											soloTypeSelection = 'KARO';
											roundType = RoundTypeEnum.SoloKaro;
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
				<input type="hidden" name="type" value={roundType} />
				{#if game.withMandatorySolos}
					<input type="hidden" name="soloType" value={soloType} />
				{/if}
				{#if editingRoundId}
					<input type="hidden" name="roundId" value={editingRoundId} />
				{/if}
			</div>

			<!-- Section 2: Eyes -->
			<div
				class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<Label class="text-sm font-semibold text-gray-900 dark:text-white"
					>Erreichte Augensumme</Label
				>
				<div class="mt-3 space-y-3">
					<div>
						<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400">Team</Label>
						<ButtonGroup class="w-full">
							<Button
								type="button"
								color={eyesTeam === TeamEnum.RE ? 'secondary' : 'light'}
								class={`flex-1 ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
								disabled={!canEditRounds}
								onclick={() => {
									if (eyesInput !== null) eyesInput = 240 - eyesInput;
									eyesTeam = TeamEnum.RE;
								}}
							>
								Re
							</Button>
							<Button
								type="button"
								color={eyesTeam === TeamEnum.KONTRA ? 'secondary' : 'light'}
								class={`flex-1 ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
								disabled={!canEditRounds}
								onclick={() => {
									if (eyesInput !== null) eyesInput = 240 - eyesInput;
									eyesTeam = TeamEnum.KONTRA;
								}}
							>
								Kontra
							</Button>
						</ButtonGroup>
					</div>

					<div>
						<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400"
							>{eyesTeam === TeamEnum.RE ? 'Re' : 'Kontra'} Augen</Label
						>
						<input
							type="number"
							min="0"
							max="240"
							value={eyesInput ?? ''}
							disabled={!canEditRounds}
							required
							oninput={(e) => {
								e.currentTarget.setCustomValidity('');
								handleEyesInput(
									e.currentTarget.value === '' ? null : parseInt(e.currentTarget.value)
								);
							}}
							oninvalid={(e) =>
								e.currentTarget.setCustomValidity('Augensumme ist leer oder ungültig.')}
							class="w-full border px-3 py-2 {eyesError
								? 'border-red-500'
								: 'border-gray-300 dark:border-gray-600'} rounded-lg bg-white text-lg font-semibold text-gray-900 focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white {eyesError
								? 'focus:ring-red-500'
								: 'focus:ring-blue-500'} focus:border-transparent"
						/>
						<input
							type="hidden"
							name="eyesRe"
							value={eyesInput !== null
								? eyesTeam === TeamEnum.RE
									? eyesInput
									: 240 - eyesInput
								: ''}
						/>
						{#if eyesError}
							<div class="mt-1 text-xs text-red-600 dark:text-red-400">{eyesError}</div>
						{:else if eyesInput !== null}
							<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{eyesTeam === TeamEnum.RE ? 'Kontra' : 'Re'} Augen: {240 - eyesInput}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Section 3: Player Teams -->
			<div
				class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<Label class="text-sm font-semibold text-gray-900 dark:text-white">Spielerteams</Label>
				{#if game.participants.length === 5}
					<p class="bold mt-2 mb-1 text-xs text-secondary-700 dark:text-secondary-200">
						<strong
							>{sortedParticipants[modalDealerPosition()]?.player?.displayName ?? 'Spieler'} setzt aus
							(Geber)</strong
						>
					</p>
				{/if}
				<p class="mt-2 mb-3 text-xs text-gray-600 dark:text-gray-400">
					Klicke auf eine Karte um das Team des Spielers zu wechseln.
				</p>
				<div class="grid grid-cols-2 gap-3">
					{#each sortedParticipants as participant}
						{@const isDealer =
							game.participants.length === 5 && participant.seatPosition === modalDealerPosition()}
						{#if !isDealer}
							{@const team = playerTeams[participant.playerId]}
							{@const calls = playerCalls[participant.playerId]}
							<div
								class="flex flex-col gap-2 rounded-lg border-2 p-3 transition {team === TeamEnum.RE
									? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
									: team === TeamEnum.KONTRA
										? 'border-red-500 bg-red-50 dark:bg-red-900/20'
										: 'border-gray-400 bg-gray-100 dark:bg-gray-700'}"
							>
								<button
									type="button"
									disabled={!canEditRounds}
									onclick={() => togglePlayerTeam(participant.playerId)}
									class={`flex flex-col items-center gap-2 transition ${!canEditRounds ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80'}`}
								>
									{#if team}
										<input
											type="hidden"
											name="player_{participant.seatPosition}_team"
											value={team}
										/>
										{#if calls?.calls.team}
											<input
												type="hidden"
												name="player_{participant.seatPosition}_call_{calls.calls.team}"
												value={calls.calls.team}
											/>
										{/if}
										{#if calls?.calls.type}
											<input
												type="hidden"
												name="player_{participant.seatPosition}_call_{calls.calls.type}"
												value={calls.calls.type}
											/>
										{/if}
										{#if bonusesAllowed}
											{#if calls?.bonus.fuchs}
												<input
													type="hidden"
													name="player_{participant.seatPosition}_bonus_FUCHS"
													value={calls.bonus.fuchs}
												/>
											{/if}
											{#if calls?.bonus.doppelkopf}
												<input
													type="hidden"
													name="player_{participant.seatPosition}_bonus_DOKO"
													value={calls.bonus.doppelkopf}
												/>
											{/if}
											{#if calls?.bonus.karlchen}
												<input
													type="hidden"
													name="player_{participant.seatPosition}_bonus_KARLCHEN"
													value={1}
												/>
											{/if}
										{/if}
									{/if}
									<div class="text-center text-sm font-medium text-gray-900 dark:text-white">
										{participant.player?.displayName ?? 'Spieler'}
									</div>
									{#if team}
										<div
											class={`rounded px-2 py-1 text-xs font-semibold ${
												team === 'RE'
													? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
													: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
											}`}
										>
											{team}
										</div>
									{:else}
										<div
											class="rounded bg-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-300"
										>
											Nicht ausgewählt
										</div>
									{/if}
								</button>

								<div
									class="border-t {team === 'RE'
										? 'border-blue-300 pt-2 dark:border-blue-700'
										: team === 'KONTRA'
											? 'border-red-300 pt-2 dark:border-red-700'
											: 'border-gray-300 pt-2 dark:border-gray-600'} space-y-3"
								>
									<!-- An- und Absagen Section -->
									<div>
										<div class="mb-1 flex items-center justify-between">
											<span class="text-xs font-medium text-gray-700 dark:text-gray-300"
												>An/Absagen:</span
											>
											<Button
												pill
												size="xs"
												color="secondary"
												disabled={!canEditRounds}
												onclick={() => onOpenCallsEdit(participant.playerId)}
												class={`p-2! ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
												title="Ansagen bearbeiten"
											>
												<EditOutline class="h-4 w-4" />
											</Button>
										</div>
										{#if calls && (calls.calls.team || calls.calls.type)}
											<div class="pl-2 text-xs text-gray-700 dark:text-gray-300">
												{calls.calls.team}
												{calls.calls.type}
											</div>
										{/if}
									</div>

									<!-- Bonuspunkte Section -->
									{#if bonusesAllowed}
										<div>
											<div class="mb-1 flex items-center justify-between">
												<span class="text-xs font-medium text-gray-700 dark:text-gray-300"
													>Bonus:</span
												>
												<Button
													pill
													size="xs"
													color="secondary"
													disabled={!canEditRounds}
													onclick={() => onOpenBonusEdit(participant.playerId)}
													class={`p-2! ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
													title="Bonus bearbeiten"
												>
													<EditOutline class="h-4 w-4" />
												</Button>
											</div>
											{#if calls && (calls.bonus.fuchs !== 0 || calls.bonus.doppelkopf !== 0 || calls.bonus.karlchen)}
												<div class="pl-2 text-xs text-gray-700 dark:text-gray-300">
													{#if calls.bonus.fuchs !== 0}Fuchs {calls.bonus
															.fuchs}x{/if}{#if calls.bonus.doppelkopf !== 0}{calls.bonus.fuchs !==
														0
															? ', '
															: ''}Doppelkopf {calls.bonus
															.doppelkopf}x{/if}{#if calls.bonus.karlchen}{calls.bonus.fuchs !==
															0 || calls.bonus.doppelkopf !== 0
															? ', '
															: ''}Karlchen{/if}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			{#if actionForm?.error}
				<Alert color="red" class="mt-2">
					{#snippet icon()}<ExclamationCircleSolid class="h-5 w-5" />{/snippet}
					<span class="font-medium">Validierungsfehler</span>
					<div>{actionForm?.error}</div>
				</Alert>
			{/if}

			<div class="mt-2 flex justify-end gap-3">
				<Button type="button" color="light" disabled={isSubmitting} onclick={() => (open = false)}
					>Abbrechen</Button
				>
				<Button type="submit" disabled={!canEditRounds || isSubmitting}>
					{isSubmitting ? 'Speichert...' : 'Speichern'}
				</Button>
			</div>
		</div>
	</form>
</Modal>
