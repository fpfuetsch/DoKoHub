<script lang="ts">
	import { Button, Modal, Label, Alert, ButtonGroup, Indicator } from 'flowbite-svelte';
	import {
		PlusOutline,
		ExclamationCircleSolid,
		EditOutline,
		MinusOutline,
		ShuffleOutline,
		RocketOutline,
		EyeOutline,
		EyeSlashOutline
	} from 'flowbite-svelte-icons';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import { Game } from '$lib/domain/game';
	import { Round } from '$lib/domain/round';
	import {
		RoundType as RoundTypeEnum,
		SoloType as SoloTypeEnum,
		Team as TeamEnum,
		CallType as CallTypeEnum,
		RoundResult as RoundResultEnum,
		BonusType as BonusTypeEnum
	} from '$lib/domain/enums';

	let { data, form }: PageProps = $props();
	let actionForm = $state<typeof form | undefined>(undefined);

	$effect(() => {
		actionForm = form;
	});
	const game: Game = $derived(data.game);

	type RoundWithPoints = { round: Round; points: ReturnType<Round['calculatePoints']> };
	type MandatorySoloSlot = {
		participant: (typeof sortedParticipants)[number];
		entry?: RoundWithPoints;
	};

	const allRoundsWithPoints: RoundWithPoints[] = $derived(
		(game.rounds ?? [])
			.map((round: Round) => {
				const instance = round instanceof Round ? round : new Round(round as any);
				return { round: instance, points: instance.calculatePoints() };
			})
			.sort((a, b) => a.round.roundNumber - b.round.roundNumber)
	);

	const roundsWithPoints: RoundWithPoints[] = $derived(
		allRoundsWithPoints.filter((entry) => {
			// Filter out mandatory solos if game has them
			if (
				game.withMandatorySolos &&
				entry.round.type.startsWith('SOLO') &&
				entry.round.soloType === SoloTypeEnum.Pflicht
			) {
				return false;
			}
			return true;
		})
	);

	// Get sorted participants by seat position
	const sortedParticipants = $derived(
		[...game.participants].sort((a, b) => a.seatPosition - b.seatPosition)
	);

	const playerOrder = $derived(sortedParticipants.map((p) => p.playerId));

	const playerTotals = $derived(
		(() => {
			const totals = new Map<string, number>();
			playerOrder.forEach((id) => totals.set(id, 0));
			allRoundsWithPoints.forEach(({ points }) => {
				points.forEach(({ playerId, points }) => {
					totals.set(playerId, (totals.get(playerId) ?? 0) + points);
				});
			});
			return totals;
		})()
	);

	const hasUpcomingRound = $derived(game.rounds.length < game.maxRoundCount && !game.isFinished());
	const isFinished = $derived(game.isFinished());
	const canEditRounds = $derived(!isFinished);
	const visibleRoundCount = $derived(roundsWithPoints.length);
	const nextRoundNumber = $derived(game.rounds.length + 1);
	const nextVisibleRoundNumber = $derived(visibleRoundCount + 1);
	const upcomingDealer = $derived(
		sortedParticipants.length
			? sortedParticipants[(nextVisibleRoundNumber - 1) % sortedParticipants.length]
			: null
	);
	const upcomingStarter = $derived(
		sortedParticipants.length
			? sortedParticipants[nextVisibleRoundNumber % sortedParticipants.length]
			: null
	);

	const mandatorySoloSlots = $derived(
		((): MandatorySoloSlot[] => {
			if (!game.withMandatorySolos) return [];
			const soloRounds = allRoundsWithPoints.filter(
				({ round }) => round.type.startsWith('SOLO') && round.soloType === SoloTypeEnum.Pflicht
			);
			return sortedParticipants.map((participant) => {
				const hit = soloRounds.find(({ round }) => {
					const soloPlayer = round.participants.find((p) => p.team === TeamEnum.RE);
					return soloPlayer?.playerId === participant.playerId;
				});
				return { participant, entry: hit } satisfies MandatorySoloSlot;
			});
		})()
	);

	const mandatorySoloPlayerIds = $derived(
		new Set(
			allRoundsWithPoints
				.filter(
					({ round }) => round.type.startsWith('SOLO') && round.soloType === SoloTypeEnum.Pflicht
				)
				.map(({ round }) => round.participants.find((p) => p.team === TeamEnum.RE)?.playerId)
				.filter(Boolean) as string[]
		)
	);

	const remainingMandatorySoloPlayers = $derived(
		sortedParticipants.filter((p) => !mandatorySoloPlayerIds.has(p.playerId))
	);

	const allMandatorySolosDone = $derived(
		!game.withMandatorySolos || remainingMandatorySoloPlayers.length === 0
	);

	const resultStyles: Record<RoundResultEnum, string> = {
		[RoundResultEnum.WON]:
			'border-emerald-400 bg-emerald-100 text-black dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100',
		[RoundResultEnum.LOST]:
			'border-rose-400 bg-rose-100 text-black dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-100',
		[RoundResultEnum.DRAW]:
			'border-slate-200 bg-slate-100 text-black dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
	};

	const placeholderTile =
		'border-dashed border-slate-200 bg-transparent text-slate-400 dark:border-slate-700 dark:text-slate-400';

	const getPlayerResult = (entry: RoundWithPoints, playerId: string) =>
		entry.points.find((p) => p.playerId === playerId);

	const formatRoundLabel = (round: Round) => {
		if (round.type === RoundTypeEnum.Normal) return 'Normal';
		if (round.type.startsWith('HOCHZEIT')) {
			const variant = round.type.replace('HOCHZEIT_', '').toLowerCase();
			if (variant === 'normal') return 'Hochzeit';
			if (variant === 'still') return 'Stille';
			if (variant === 'ungeklaert') return 'Ungeklärt';
			return variant;
		}
		if (round.type.startsWith('SOLO')) {
			const variant = round.type.replace('SOLO_', '').toLowerCase();
			const isPflicht = round.soloType === SoloTypeEnum.Pflicht;

			// Map solo types to names
			const soloTypeMap: Record<string, string> = {
				kreuz: 'Kreuz',
				pik: 'Pik',
				herz: 'Herz',
				karo: 'Karo',
				buben: 'Buben',
				damen: 'Damen',
				ass: 'Ass'
			};

			const displayType = soloTypeMap[variant] || variant;

			if (isPflicht) {
				return `${displayType}`;
			}

			return displayType;
		}
		return round.type.replaceAll('_', ' ');
	};

	let roundModal = $state(false);
	let roundType = $state<string>(RoundTypeEnum.Normal);
	let soloType = $state<SoloTypeEnum | null>(null);
	let soloTypeSelection = $state<string | null>(null);
	let eyesInput = $state(120);
	let eyesTeam = $state<TeamEnum>(TeamEnum.RE);
	let eyesError = $state<string | null>(null);
	let playerTeams = $state<Record<string, TeamEnum | undefined>>({});
	let showSum = $state(false);
	let editingRoundId = $state<string | null>(null);
	let editingMandatorySolo = $state(false);
	const bonusesAllowed = $derived(
		roundType === RoundTypeEnum.Normal || roundType === RoundTypeEnum.HochzeitNormal
	);

	$effect(() => {
		// Only auto-switch Pflicht -> Lust when creating a new round; keep Pflicht when editing an existing Pflichtsolo
		if (
			!editingRoundId &&
			game.withMandatorySolos &&
			remainingMandatorySoloPlayers.length === 0 &&
			soloType === SoloTypeEnum.Pflicht
		) {
			soloType = SoloTypeEnum.Lust;
		}
	});

	$effect(() => {
		if (!hasUpcomingRound) {
			showSum = true;
		}
	});

	// Player calls and bonus points
	let playerCalls = $state<
		Record<
			string,
			{
				calls: {
					team: TeamEnum | null;
					type: CallTypeEnum | null;
				};
				bonus: { fuchs: number; doppelkopf: number; karlchen: boolean };
			}
		>
	>({});
	let callsEditModal = $state(false);
	let bonusEditModal = $state(false);
	let editingPlayerId = $state<string | null>(null);

	// Initialize player teams when modal opens
	$effect(() => {
		if (roundModal && Object.keys(playerTeams).length === 0) {
			const teams: Record<string, TeamEnum | undefined> = {};
			const calls: Record<
				string,
				{
					calls: {
						team: TeamEnum | null;
						type: CallTypeEnum | null;
					};
					bonus: { fuchs: number; doppelkopf: number; karlchen: boolean };
				}
			> = {};
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
			eyesInput = Math.max(0, Math.min(240, input));
		} else {
			eyesError = null;
			eyesInput = input;
		}
	};

	const handleRoundSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
				roundModal = false;
				// Reset form
				actionForm = undefined;
				roundType = RoundTypeEnum.Normal;
				soloType = null;
				soloTypeSelection = null;
				eyesInput = 120;
				eyesTeam = TeamEnum.RE;
				eyesError = null;
				playerTeams = {};
				playerCalls = {};
				editingRoundId = null;
				editingMandatorySolo = false;
			}
			await applyAction(result);
		};
	};

	const startNewRound = () => {
		actionForm = undefined;
		roundType = RoundTypeEnum.Normal;
		soloType = null;
		soloTypeSelection = null;
		eyesInput = 120;
		eyesTeam = TeamEnum.RE;
		eyesError = null;
		playerTeams = {};
		playerCalls = {};
		editingRoundId = null;
		editingMandatorySolo = false;
		roundModal = true;
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

	// Get the final round type based on selections
	const getFinalRoundType = (): string => {
		if (roundType === RoundTypeEnum.Normal) return RoundTypeEnum.Normal;
		if (roundType.startsWith('HOCHZEIT')) return roundType;
		if (roundType.startsWith('SOLO') && soloTypeSelection) {
			return `SOLO_${soloTypeSelection}`;
		}
		return roundType;
	};

	const loadRoundIntoForm = (entry: RoundWithPoints) => {
		actionForm = undefined;
		const round = entry.round;
		roundType = round.type;
		soloType = round.soloType;
		editingMandatorySolo = round.soloType === SoloTypeEnum.Pflicht;
		// If editing a non-mandatory solo, ensure Lust is preselected immediately
		if (round.type.startsWith('SOLO') && !editingMandatorySolo) {
			soloType = SoloTypeEnum.Lust;
		}
		soloTypeSelection = round.type.startsWith('SOLO') ? round.type.replace('SOLO_', '') : null;
		eyesInput = round.eyesRe;
		eyesTeam = TeamEnum.RE;
		eyesError = null;

		const teams: Record<string, TeamEnum | undefined> = {};
		const calls: typeof playerCalls = {};
		sortedParticipants.forEach((p) => {
			const participant = round.participants.find((rp) => rp.playerId === p.playerId);
			teams[p.playerId] = participant?.team;

			const teamCall = participant?.calls.find(
				(c) => c.callType === CallTypeEnum.RE || c.callType === CallTypeEnum.KONTRA
			);
			const absageCall = participant?.calls.find(
				(c) => ![CallTypeEnum.RE, CallTypeEnum.KONTRA].includes(c.callType)
			);
			const fuchs =
				participant?.bonuses.find((b) => b.bonusType === BonusTypeEnum.Fuchs)?.count ?? 0;
			const doko = participant?.bonuses.find((b) => b.bonusType === BonusTypeEnum.Doko)?.count ?? 0;
			const karlchen =
				participant?.bonuses.find((b) => b.bonusType === BonusTypeEnum.Karlchen)?.count === 1 ||
				false;

			calls[p.playerId] = {
				calls: {
					team: teamCall
						? teamCall.callType === CallTypeEnum.RE
							? TeamEnum.RE
							: TeamEnum.KONTRA
						: null,
					type: absageCall ? absageCall.callType : null
				},
				bonus: { fuchs, doppelkopf: doko, karlchen }
			};
		});

		playerTeams = teams;
		playerCalls = calls;
		editingRoundId = round.id;
		roundModal = true;
	};
</script>

<div class="flex flex-col p-4 sm:p-6">
	<section class={`mx-auto w-full max-w-4xl space-y-4 ${hasUpcomingRound ? 'pb-20' : ''}`}>
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Standardrunden</h2>
			</div>

			<div class="overflow-x-auto">
				<div class="min-w-full space-y-2">
					<div
						class="grid items-center gap-2 p-0 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
					>
						<div class="px-2 text-center">Runde</div>
						{#each sortedParticipants as participant}
							<div
								class="truncate px-2 text-center"
								title={participant.player?.displayName ?? 'Spieler'}
							>
								{participant.player?.displayName ?? 'Spieler'}
							</div>
						{/each}
					</div>

					<div class="mx-1 my-2 h-px bg-gray-200 dark:bg-gray-700"></div>

					{#each roundsWithPoints as entry, idx (entry.round.id)}
						<div
							role={canEditRounds ? 'button' : undefined}
							class={`grid w-full cursor-pointer items-stretch gap-2 p-0 text-left transition hover:bg-gray-100/60 focus:outline-none dark:hover:bg-gray-800/60`}
							style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
							onclick={() => loadRoundIntoForm(entry)}
							onkeydown={(event) =>
								(event.key === 'Enter' || event.key === ' ') && loadRoundIntoForm(entry)}
						>
							<div
								class="flex flex-col justify-center gap-0.5 px-2 py-2 text-xs text-gray-900 dark:text-gray-100"
							>
								<span class="leading-tight font-semibold">{entry.round.roundNumber}</span>
								<span
									class="truncate text-[8px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
								>
									{formatRoundLabel(entry.round)}
								</span>
							</div>
							{#each sortedParticipants as participant}
								{@const participantTeam = entry.round.participants.find(
									(p) => p.playerId === participant.playerId
								)?.team}
								{@const result = getPlayerResult(entry, participant.playerId)}
								<div
									class={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-sm font-semibold shadow-sm ${result ? resultStyles[result.result] : placeholderTile} ${participantTeam === TeamEnum.RE ? 'border' : ''}`}
									title={result?.result === RoundResultEnum.WON
										? 'Sieg'
										: result?.result === RoundResultEnum.LOST
											? 'Niederlage'
											: result?.result === RoundResultEnum.DRAW
												? 'Remis'
												: 'Offen'}
								>
									<div class="text-lg leading-none font-bold">{result?.points ?? 0}</div>
								</div>
							{/each}
						</div>

						{#if (idx + 1) % 4 === 0 && idx !== roundsWithPoints.length - 1}
							<div class="mx-1 my-2 h-px bg-gray-200 dark:bg-gray-700"></div>
						{/if}
					{/each}

					{#if hasUpcomingRound}
						<div
							class="grid items-stretch gap-2 p-0"
							style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
						>
							<div
								class="flex flex-col justify-center gap-0.5 px-2 py-2 text-xs font-semibold text-gray-800 dark:text-gray-100"
							>
								<span class="leading-tight">{nextRoundNumber}</span>
							</div>
							{#each sortedParticipants as participant}
								<div
									class="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-700 px-2 py-3 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-200"
								>
									{#if upcomingDealer && participant.playerId === upcomingDealer.playerId}
										<ShuffleOutline class="h-5 w-5" />
									{:else if upcomingStarter && participant.playerId === upcomingStarter.playerId}
										<RocketOutline class="h-5 w-5" />
									{:else}
										<div
											class="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600"
											aria-hidden="true"
										></div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
						<div class="flex items-center gap-1">
							<ShuffleOutline class="h-3.5 w-3.5" /> <span>Mischen</span>
						</div>
						<div class="flex items-center gap-1">
							<RocketOutline class="h-3.5 w-3.5" /> <span>Aufspiel</span>
						</div>
						<div class="flex items-center gap-1">
							<div
								class="h-3.5 w-3.5 rounded-sm border-2 border-gray-500 dark:border-gray-400"
								aria-hidden="true"
							></div>
							<span>Re</span>
						</div>
						<div class="flex items-center gap-1">
							<div
								class="h-3.5 w-3.5 rounded-md border border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40"
								aria-hidden="true"
							></div>
							<span>Sieg</span>
						</div>
						<div class="flex items-center gap-1">
							<div
								class="h-3.5 w-3.5 rounded-md border border-rose-300 bg-rose-100 dark:border-rose-800 dark:bg-rose-900/40"
								aria-hidden="true"
							></div>
							<span>Niederlage</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		{#if game.withMandatorySolos}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Pflichtsoli</h3>
				</div>

				<div class="space-y-1">
					<div
						class="grid items-center gap-2 p-0 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
					>
						<div class="px-2 text-center">Runde</div>
						{#each sortedParticipants as participant}
							<div class="truncate px-2 text-center">
								{participant.player?.displayName ?? 'Spieler'}
							</div>
						{/each}
					</div>

					<div class="mx-1 my-2 h-px bg-gray-200 dark:bg-gray-700"></div>

					{#each mandatorySoloSlots as slot, idx}
						<div
							role={canEditRounds && slot.entry ? 'button' : undefined}
							aria-disabled={!slot.entry || !canEditRounds}
							class={`grid w-full cursor-pointer items-stretch gap-2 bg-transparent p-0 text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/60 ${slot.entry ? '' : 'pointer-events-none opacity-70'}`}
							style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
							onclick={() => slot.entry && loadRoundIntoForm(slot.entry)}
							onkeydown={(event) =>
								slot.entry &&
								(event.key === 'Enter' || event.key === ' ') &&
								loadRoundIntoForm(slot.entry)}
						>
							<div
								class="flex flex-col justify-center gap-0.5 px-2 py-2 text-xs text-gray-900 dark:text-gray-100"
							>
								<span class="leading-tight font-semibold"
									>{slot.entry ? slot.entry.round.roundNumber : '–'}</span
								>
								{#if slot.entry}
									<span
										class="truncate text-[8px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
										>{formatRoundLabel(slot.entry.round)}</span
									>
								{/if}
							</div>

							{#each sortedParticipants as participant}
								{@const soloResult = slot.entry
									? getPlayerResult(slot.entry, participant.playerId)
									: null}
								{@const participantTeam = slot.entry
									? slot.entry.round.participants.find((p) => p.playerId === participant.playerId)
											?.team
									: null}
								<div
									class={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-sm font-semibold shadow-sm ${soloResult ? resultStyles[soloResult.result] : placeholderTile} ${participantTeam === TeamEnum.RE ? 'border' : ''}`}
									title={soloResult?.result === RoundResultEnum.WON
										? 'Sieg'
										: soloResult?.result === RoundResultEnum.LOST
											? 'Niederlage'
											: soloResult?.result === RoundResultEnum.DRAW
												? 'Remis'
												: 'Offen'}
								>
									<div class="text-lg leading-none font-bold">{soloResult?.points ?? 0}</div>
									<span class="sr-only">
										{#if soloResult?.result === RoundResultEnum.WON}
											Sieg
										{:else if soloResult?.result === RoundResultEnum.LOST}
											Niederlage
										{:else if soloResult?.result === RoundResultEnum.DRAW}
											Remis
										{:else}
											Offen
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Summe</h3>
				{#if hasUpcomingRound}
					<Button
						color="secondary"
						size="xs"
						class="flex items-center gap-1 px-3 py-2"
						aria-label={showSum ? 'Ausblenden' : 'Anzeigen'}
						onclick={() => (showSum = !showSum)}
					>
						{#if showSum}
							<EyeSlashOutline class="h-4 w-4" />
							<span>Ausblenden</span>
						{:else}
							<EyeOutline class="h-4 w-4" />
							<span>Anzeigen</span>
						{/if}
					</Button>
				{/if}
			</div>

			<div
				class="grid items-stretch gap-2 p-0 transition duration-150"
				style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
			>
				<div
					class="flex items-center px-2 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100"
				></div>
				{#each sortedParticipants as participant}
					<div
						class="flex flex-col items-center justify-center rounded-md border border-gray-200 px-2 py-3 text-sm font-semibold text-gray-800 shadow-sm dark:border-secondary-700 dark:text-gray-100"
					>
						{#if showSum}
							<div class="text-lg leading-none font-bold">
								{playerTotals.get(participant.playerId) ?? 0}
							</div>
						{:else}
							<div class="text-lg leading-none font-bold blur-sm select-none">000</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if !isFinished}
			{#if !hasUpcomingRound && allMandatorySolosDone}
				<div
					class="rounded-lg border border-primary bg-white p-4 shadow-sm dark:border-secondary-800 dark:bg-gray-800/60"
				>
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Spiel abschließen</h3>
					</div>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						Alle Runden sind gespielt. Wenn du das Spiel abschließt können Runden nicht mehr
						bearbeitet werden.
					</p>
					<form method="POST" action="?/finishGame" class="mt-3 flex justify-end">
						<Button type="submit" color="primary" class="px-4 py-2">Spiel abschließen</Button>
					</form>
				</div>
			{:else if !hasUpcomingRound && !allMandatorySolosDone}
				<div
					class="rounded-lg border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-700 dark:bg-gray-800/60"
				>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Spiel abschließen</h3>
					<p class="mt-1 text-sm text-amber-700 dark:text-amber-200">
						Pflichtsoli fehlen noch: {remainingMandatorySoloPlayers
							.map((p) => p.player?.displayName ?? 'Spieler')
							.join(', ')}
					</p>
				</div>
			{/if}
		{/if}
	</section>
</div>

{#if hasUpcomingRound && !isFinished}
	<Button
		pill={false}
		class="fixed right-6 bottom-6 z-50 rounded-2xl p-2 shadow-lg"
		onclick={startNewRound}
		aria-label="Runde hinzufügen"
	>
		<PlusOutline class="h-10 w-10" />
	</Button>
{/if}

<Modal bind:open={roundModal} size="lg" autoclose={false} class="p-2 *:border-0!">
	<form method="POST" action="?/saveRound" use:enhance={handleRoundSubmit}>
		<div class="flex flex-col space-y-2">
			<h3 class="mb-6 text-xl font-medium text-gray-900 dark:text-white">
				{editingRoundId ? 'Runde bearbeiten' : 'Füge eine neue Runde hinzu'}
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
				<input type="hidden" name="type" value={getFinalRoundType()} />
				{#if soloType}
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
									eyesInput = 240 - eyesInput;
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
									eyesInput = 240 - eyesInput;
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
							value={eyesInput}
							disabled={!canEditRounds}
							oninput={(e) => handleEyesInput(parseInt(e.currentTarget.value) || 0)}
							class="w-full border px-3 py-2 {eyesError
								? 'border-red-500'
								: 'border-gray-300 dark:border-gray-600'} rounded-lg bg-white text-lg font-semibold text-gray-900 focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white {eyesError
								? 'focus:ring-red-500'
								: 'focus:ring-blue-500'} focus:border-transparent"
						/>
						<input
							type="hidden"
							name="eyesRe"
							value={eyesTeam === TeamEnum.RE ? eyesInput : 240 - eyesInput}
						/>
						{#if eyesError}
							<div class="mt-1 text-xs text-red-600 dark:text-red-400">{eyesError}</div>
						{:else}
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
				<p class="mt-2 mb-3 text-xs text-gray-600 dark:text-gray-400">
					Klicke auf eine Karte um das Team zu wechseln
				</p>
				<div class="grid grid-cols-2 gap-3">
					{#each sortedParticipants as participant}
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
									<input type="hidden" name="player_{participant.seatPosition}_team" value={team} />
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
											onclick={() => {
												editingPlayerId = participant.playerId;
												callsEditModal = true;
											}}
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
												onclick={() => {
													editingPlayerId = participant.playerId;
													bonusEditModal = true;
												}}
												class={`p-2! ${!canEditRounds ? 'cursor-not-allowed opacity-60' : ''}`}
												title="Bonus bearbeiten"
											>
												<EditOutline class="h-4 w-4" />
											</Button>
										</div>
										{#if calls && (calls.bonus.fuchs !== 0 || calls.bonus.doppelkopf !== 0 || calls.bonus.karlchen)}
											<div class="pl-2 text-xs text-gray-700 dark:text-gray-300">
												{#if calls.bonus.fuchs !== 0}Fuchs {calls.bonus
														.fuchs}x{/if}{#if calls.bonus.doppelkopf !== 0}{calls.bonus.fuchs !== 0
														? ', '
														: ''}Doppelkopf {calls.bonus
														.doppelkopf}x{/if}{#if calls.bonus.karlchen}{calls.bonus.fuchs !== 0 ||
													calls.bonus.doppelkopf !== 0
														? ', '
														: ''}Karlchen{/if}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
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
				<Button type="button" color="light" onclick={() => (roundModal = false)}>Abbrechen</Button>
				<Button type="submit" disabled={!canEditRounds}>Speichern</Button>
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
					<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400">Ansage</Label>
					<ButtonGroup class="w-full">
						<Button
							type="button"
							color={playerData.calls.team === TeamEnum.RE ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.team = playerData.calls.team === TeamEnum.RE ? null : TeamEnum.RE;
							}}
						>
							Re
						</Button>
						<Button
							type="button"
							color={playerData.calls.team === TeamEnum.KONTRA ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.team =
									playerData.calls.team === TeamEnum.KONTRA ? null : TeamEnum.KONTRA;
							}}
						>
							Kontra
						</Button>
					</ButtonGroup>
				</div>

				<div>
					<Label class="mb-2 block text-xs text-gray-600 dark:text-gray-400">Absage</Label>
					<ButtonGroup class="w-full">
						<Button
							type="button"
							color={playerData.calls.type === CallTypeEnum.Keine90 ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.type =
									playerData.calls.type === CallTypeEnum.Keine90 ? null : CallTypeEnum.Keine90;
							}}
						>
							Keine 90
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === CallTypeEnum.Keine60 ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.type =
									playerData.calls.type === CallTypeEnum.Keine60 ? null : CallTypeEnum.Keine60;
							}}
						>
							Keine 60
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === CallTypeEnum.Keine30 ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.type =
									playerData.calls.type === CallTypeEnum.Keine30 ? null : CallTypeEnum.Keine30;
							}}
						>
							Keine 30
						</Button>
						<Button
							type="button"
							color={playerData.calls.type === CallTypeEnum.Schwarz ? 'secondary' : 'light'}
							class="flex-1  py-1 text-xs"
							onclick={() => {
								playerData.calls.type =
									playerData.calls.type === CallTypeEnum.Schwarz ? null : CallTypeEnum.Schwarz;
							}}
						>
							Schwarz
						</Button>
					</ButtonGroup>
				</div>
			</div>

			<div class="mt-2 flex justify-end gap-3">
				<Button type="button" color="primary" onclick={() => (callsEditModal = false)}>
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

			<div class="mt-2 flex justify-end gap-3">
				<Button type="button" color="primary" onclick={() => (bonusEditModal = false)}>
					Fertig
				</Button>
			</div>
		</div>
	{/if}
</Modal>
