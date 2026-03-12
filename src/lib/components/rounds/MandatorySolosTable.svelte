<script lang="ts">
	import { Popover } from 'flowbite-svelte';
	import { ShuffleOutline } from 'flowbite-svelte-icons';
	import type { GameParticipant } from '$lib/domain/game';
	import type { Round, RoundPoints } from '$lib/domain/round';
	import { Team as TeamEnum, RoundResult as RoundResultEnum } from '$lib/domain/enums';
	import { formatRoundLabel, getPlayerResult, placeholderTile, resultStyles } from './roundDisplay';

	type RoundWithPoints = { round: Round; points: RoundPoints[] };
	type MandatorySoloSlot = {
		participant: GameParticipant;
		entry?: RoundWithPoints;
	};

	export let sortedParticipants: GameParticipant[];
	export let mandatorySoloSlots: MandatorySoloSlot[];
	export let canEditRounds: boolean;
	export let is5PlayerGame: boolean;
	export let onEditRound: (entry: RoundWithPoints) => void;
</script>

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
				<div class="truncate px-2 text-center" title={participant.player?.displayName ?? 'Spieler'}>
					<button
						id="popover-solo-{participant.playerId}"
						class="block w-full truncate border-0 bg-transparent p-0 text-inherit"
						title={participant.player?.displayName ?? 'Spieler'}
					>
						{participant.player?.displayName ?? 'Spieler'}
					</button>
					<Popover triggeredBy="#{`popover-solo-${participant.playerId}`}" class="text-sm">
						<div class="text-gray-900 normal-case dark:text-white">
							{participant.player?.displayName ?? 'Spieler'}
						</div>
					</Popover>
				</div>
			{/each}
		</div>

		<div class="mx-1 my-2 h-px bg-gray-200 dark:bg-gray-700"></div>

		{#each mandatorySoloSlots as slot}
			<div
				role={canEditRounds && slot.entry ? 'button' : undefined}
				aria-disabled={!slot.entry || !canEditRounds}
				class={`grid w-full cursor-pointer items-stretch gap-2 bg-transparent p-0 text-left hover:bg-gray-100/60 dark:hover:bg-gray-800/60 ${slot.entry ? '' : 'pointer-events-none opacity-70'}`}
				style={`grid-template-columns: 70px repeat(${sortedParticipants.length}, minmax(0, 1fr));`}
				onclick={() => slot.entry && onEditRound(slot.entry)}
				onkeydown={(event) =>
					slot.entry && (event.key === 'Enter' || event.key === ' ') && onEditRound(slot.entry)}
			>
				<div
					class="flex flex-col justify-center gap-0.5 px-2 py-2 text-xs text-gray-900 dark:text-gray-100"
				>
					<span class="leading-tight font-semibold">
						{slot.entry ? slot.entry.round.roundNumber : '-'}
					</span>
					{#if slot.entry}
						<span
							class="truncate text-[8px] font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
						>
							{formatRoundLabel(slot.entry.round)}
						</span>
					{/if}
				</div>

				{#each sortedParticipants as participant}
					{@const soloResult = slot.entry
						? getPlayerResult(slot.entry, participant.playerId)
						: null}
					{@const participantTeam = slot.entry
						? slot.entry.round.participants.find((p) => p.playerId === participant.playerId)?.team
						: null}
					{@const isSoloDealer =
						is5PlayerGame &&
						slot.entry &&
						!slot.entry.round.participants.find((p) => p.playerId === participant.playerId)}
					<div
						class={`flex flex-col items-center justify-center rounded-md px-2 py-3 text-sm font-semibold shadow-sm ${isSoloDealer ? 'opacity-40' : soloResult ? resultStyles[soloResult.result] : placeholderTile} ${participantTeam === TeamEnum.RE ? 'border-2' : ''}`}
						title={isSoloDealer
							? 'Geber'
							: soloResult?.result === RoundResultEnum.WON
								? 'Sieg'
								: soloResult?.result === RoundResultEnum.LOST
									? 'Niederlage'
									: soloResult?.result === RoundResultEnum.DRAW
										? 'Remis'
										: 'Offen'}
					>
						{#if isSoloDealer}
							<ShuffleOutline class="h-5 w-5" />
						{:else if soloResult}
							<div class="text-lg leading-none font-bold">{soloResult.points}</div>
						{:else}
							<div class="relative text-lg leading-none font-bold">
								<span class="invisible">0</span>
								<div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
									<div class="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
								</div>
							</div>
						{/if}
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
