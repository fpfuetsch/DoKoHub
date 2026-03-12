<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';
	import { Game } from '$lib/domain/game';
	import { Round } from '$lib/domain/round';
	import StandardRoundsTable from '$lib/components/rounds/StandardRoundsTable.svelte';
	import MandatorySolosTable from '$lib/components/rounds/MandatorySolosTable.svelte';
	import PointsTotals from '$lib/components/rounds/PointsTotals.svelte';
	import GameFinishPrompt from '$lib/components/rounds/GameFinishPrompt.svelte';
	import AwardCeremonyModal from '$lib/components/rounds/AwardCeremonyModal.svelte';
	import RoundFormModal from '$lib/components/rounds/RoundFormModal.svelte';
	import CallsEditModal from '$lib/components/rounds/CallsEditModal.svelte';
	import BonusEditModal from '$lib/components/rounds/BonusEditModal.svelte';
	import {
		RoundType as RoundTypeEnum,
		SoloType as SoloTypeEnum,
		Team as TeamEnum,
		CallType as CallTypeEnum,
		BonusType as BonusTypeEnum
	} from '$lib/domain/enums';

	let { data, form }: PageProps = $props();
	let actionForm = $state<typeof form | undefined>(undefined);

	$effect(() => {
		actionForm = form;
	});
	const game: Game = $derived(data.game);

	type RoundRealtimeEvent = {
		eventId: string;
		timestamp: number;
	};

	const realtimeDebounceMs = 300;
	let realtimeRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastRealtimeEventId: string | null = null;

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
			if (game.withMandatorySolos && entry.round.isMandatorySolo()) {
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
	const nextRoundNumber = $derived(game.rounds.length + 1);

	let awardCeremonyOpen = $state(false);
	const startAwardCeremony = () => {
		awardCeremonyOpen = true;
	};

	// For 5-player games, calculate dealer who sits out
	// For 4-player games, dealer and starter follow the normal rotation
	const is5PlayerGame = $derived(game.participants.length === 5);

	const upcomingDealerPosition = $derived(game.getDealerPosition(nextRoundNumber));

	const upcomingDealer = $derived(game.getDealerForRound(nextRoundNumber));

	const upcomingStarter = $derived(
		upcomingDealer
			? sortedParticipants[(upcomingDealer.seatPosition + 1) % sortedParticipants.length]
			: null
	);

	const mandatorySoloSlots = $derived(
		((): MandatorySoloSlot[] => {
			if (!game.withMandatorySolos) return [];
			const soloRounds = allRoundsWithPoints.filter(({ round }) => round.isMandatorySolo());
			const slots = sortedParticipants.map((participant) => {
				const hit = soloRounds.find(({ round }) => {
					const soloPlayer = round.participants.find((p) => p.team === TeamEnum.RE);
					return soloPlayer?.playerId === participant.playerId;
				});
				return { participant, entry: hit } satisfies MandatorySoloSlot;
			});
			// Sort by round number, with unplayed solos at the end
			return slots.sort((a, b) => {
				if (!a.entry && !b.entry) return 0;
				if (!a.entry) return 1;
				if (!b.entry) return -1;
				return a.entry.round.roundNumber - b.entry.round.roundNumber;
			});
		})()
	);

	const mandatorySoloPlayerIds = $derived(
		new Set(
			allRoundsWithPoints
				.filter(({ round }) => round.isMandatorySolo())
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

	let roundModal = $state(false);
	let roundType = $state<string>(RoundTypeEnum.Normal);
	let soloType = $state<SoloTypeEnum | null>(null);
	let soloTypeSelection = $state<string | null>(null);
	let eyesInput = $state<number | null>(120);
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
		if (isFinished) {
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

	const openCallsEdit = (playerId: string) => {
		editingPlayerId = playerId;
		callsEditModal = true;
	};

	const openBonusEdit = (playerId: string) => {
		editingPlayerId = playerId;
		bonusEditModal = true;
	};

	// Calculate dealer position for the modal (either for editing or for new round)
	const modalDealerPosition = $derived(() => {
		if (editingRoundId) {
			const editingRound = allRoundsWithPoints.find((entry) => entry.round.id === editingRoundId);
			return editingRound
				? game.getDealerPosition(editingRound.round.roundNumber)
				: upcomingDealerPosition;
		}
		return upcomingDealerPosition;
	});

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

	const queueRealtimeRefresh = () => {
		if (realtimeRefreshTimeout) {
			clearTimeout(realtimeRefreshTimeout);
		}

		realtimeRefreshTimeout = setTimeout(async () => {
			realtimeRefreshTimeout = null;
			await invalidateAll();
		}, realtimeDebounceMs);
	};

	onMount(() => {
		if (!game.groupId || !game.id) return;

		const eventSource = new EventSource(`/groups/${game.groupId}/games/${game.id}/rounds`);

		eventSource.addEventListener('rounds-updated', (event) => {
			let payload: RoundRealtimeEvent;
			try {
				const messageEvent = event as MessageEvent<string>;
				payload = JSON.parse(messageEvent.data) as RoundRealtimeEvent;
			} catch {
				return;
			}

			if (payload.eventId === lastRealtimeEventId) return;

			lastRealtimeEventId = payload.eventId;
			queueRealtimeRefresh();
		});

		return () => {
			eventSource.close();
			if (realtimeRefreshTimeout) {
				clearTimeout(realtimeRefreshTimeout);
				realtimeRefreshTimeout = null;
			}
		};
	});

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

<div class="flex flex-col">
	<section class={`mx-auto w-full max-w-4xl space-y-4 ${hasUpcomingRound ? 'pb-20' : ''}`}>
		<StandardRoundsTable
			{game}
			{sortedParticipants}
			{roundsWithPoints}
			{canEditRounds}
			{is5PlayerGame}
			{hasUpcomingRound}
			{nextRoundNumber}
			{upcomingDealer}
			{upcomingStarter}
			onEditRound={loadRoundIntoForm}
		/>

		{#if game.withMandatorySolos}
			<MandatorySolosTable
				{sortedParticipants}
				{mandatorySoloSlots}
				{canEditRounds}
				{is5PlayerGame}
				onEditRound={loadRoundIntoForm}
			/>
		{/if}

		<PointsTotals
			{sortedParticipants}
			{playerTotals}
			{isFinished}
			{showSum}
			onToggleShowSum={() => (showSum = !showSum)}
		/>

		<GameFinishPrompt
			{isFinished}
			{hasUpcomingRound}
			{allMandatorySolosDone}
			{remainingMandatorySoloPlayers}
			groupId={game.groupId}
			gameId={game.id}
			onStartAwardCeremony={startAwardCeremony}
		/>
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

<AwardCeremonyModal bind:open={awardCeremonyOpen} {sortedParticipants} {playerTotals} />

<RoundFormModal
	bind:open={roundModal}
	{isFinished}
	{canEditRounds}
	{bonusesAllowed}
	{game}
	{remainingMandatorySoloPlayers}
	{sortedParticipants}
	{modalDealerPosition}
	{actionForm}
	{handleRoundSubmit}
	onOpenCallsEdit={openCallsEdit}
	onOpenBonusEdit={openBonusEdit}
	bind:roundType
	bind:soloType
	bind:soloTypeSelection
	bind:eyesInput
	bind:eyesTeam
	bind:eyesError
	{editingRoundId}
	{editingMandatorySolo}
	bind:playerTeams
	bind:playerCalls
/>

<CallsEditModal bind:open={callsEditModal} {editingPlayerId} {sortedParticipants} {playerCalls} />

<BonusEditModal
	bind:open={bonusEditModal}
	{editingPlayerId}
	{sortedParticipants}
	{playerCalls}
	{bonusesAllowed}
/>
