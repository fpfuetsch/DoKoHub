<script lang="ts">
	import { Popover } from 'flowbite-svelte';
	import { ShuffleOutline, RocketOutline } from 'flowbite-svelte-icons';
	import type { Game, GameParticipant } from '$lib/domain/game';
	import type { Round, RoundPoints } from '$lib/domain/round';
	import { Team as TeamEnum, RoundResult as RoundResultEnum } from '$lib/domain/enums';
	import { formatRoundLabel, getPlayerResult, placeholderTile, resultStyles } from './roundDisplay';

	type RoundWithPoints = { round: Round; points: RoundPoints[] };

	export let game: Game;
	export let sortedParticipants: GameParticipant[];
	export let roundsWithPoints: RoundWithPoints[];
	export let canEditRounds: boolean;
	export let is5PlayerGame: boolean;
	export let hasUpcomingRound: boolean;
	export let nextRoundNumber: number;
	export let upcomingDealer: GameParticipant | null;
	export let upcomingStarter: GameParticipant | null;
	export let onEditRound: (entry: RoundWithPoints) => void;
</script>

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
						<button
							id="popover-{participant.playerId}"
							class="block w-full truncate border-0 bg-transparent p-0 text-inherit"
							title={participant.player?.displayName ?? 'Spieler'}
						>
							{participant.player?.displayName ?? 'Spieler'}
						</button>
						<Popover triggeredBy="#{`popover-${participant.playerId}`}" class="text-sm">
							<div class="text-gray-900 normal-case dark:text-white">
								{participant.player?.displayName ?? 'Spieler'}
							</div>
						</Popover>
					</div>
				{/each}
			</div>

			<div class="mx-1 my-2 h-px bg-gray-200 dark:bg-gray-700"></div>

			{#each roundsWithPoints as entry, idx (entry.round.id)}
				{@const roundDealer = game.getDealerForRound(entry.round.roundNumber)}
				<div
					role={canEditRounds ? 'button' : undefined}
					class={`grid w-full cursor-pointer items-stretch gap-2 p-0 text-left transition hover:bg-gray-100/60 focus:outline-none dark:hover:bg-gray-800/60`}
					style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
					onclick={() => onEditRound(entry)}
					onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && onEditRound(entry)}
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
						{@const isRoundDealer =
							is5PlayerGame && roundDealer && participant.playerId === roundDealer.playerId}
						{@const participantTeam = entry.round.participants.find(
							(p) => p.playerId === participant.playerId
						)?.team}
						{@const result = getPlayerResult(entry, participant.playerId)}
						<div
							class={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-sm font-semibold shadow-sm ${isRoundDealer ? 'opacity-40' : result ? resultStyles[result.result] : placeholderTile} ${participantTeam === TeamEnum.RE ? 'border-2' : ''}`}
							title={isRoundDealer
								? 'Geber'
								: result?.result === RoundResultEnum.WON
									? 'Sieg'
									: result?.result === RoundResultEnum.LOST
										? 'Niederlage'
										: result?.result === RoundResultEnum.DRAW
											? 'Remis'
											: 'Offen'}
						>
							{#if isRoundDealer}
								<ShuffleOutline class="h-5 w-5" />
							{:else}
								<div class="text-lg leading-none font-bold">{result?.points ?? 0}</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if (idx + 1) % (is5PlayerGame ? 5 : 4) === 0 && idx !== roundsWithPoints.length - 1}
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
						{@const isUpcomingDealer =
							upcomingDealer && participant.playerId === upcomingDealer.playerId}
						<div
							class="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-700 px-2 py-3 text-xs font-semibold {isUpcomingDealer &&
							is5PlayerGame
								? 'bg-gray-100 opacity-40 dark:bg-gray-800'
								: 'text-gray-600 dark:text-gray-200'} dark:border-gray-700"
						>
							{#if isUpcomingDealer}
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
					<ShuffleOutline class="h-3.5 w-3.5" /> <span>Geber</span>
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
