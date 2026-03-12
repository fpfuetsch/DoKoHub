<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { EyeOutline, EyeSlashOutline, AwardOutline } from 'flowbite-svelte-icons';
	import type { GameParticipant } from '$lib/domain/game';

	let {
		sortedParticipants,
		playerTotals,
		isFinished,
		showSum,
		onToggleShowSum
	}: {
		sortedParticipants: GameParticipant[];
		playerTotals: Map<string, number>;
		isFinished: boolean;
		showSum: boolean;
		onToggleShowSum: () => void;
	} = $props();

	const podiumRanks = $derived(
		(() => {
			if (!isFinished) return new Map<string, number>();

			const uniqueScores = Array.from(new Set(playerTotals.values())).sort((a, b) => b - a);
			const scoreToRank = new Map<number, number>();
			uniqueScores.forEach((score, index) => {
				scoreToRank.set(score, index + 1);
			});

			const ranks = new Map<string, number>();
			for (const [playerId, score] of playerTotals.entries()) {
				const rank = scoreToRank.get(score);
				if (rank && rank <= 3) {
					ranks.set(playerId, rank);
				}
			}

			return ranks;
		})()
	);
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Summe</h3>
		{#if !isFinished}
			<Button
				color="secondary"
				size="xs"
				class="flex items-center gap-1 px-3 py-2"
				aria-label={showSum ? 'Ausblenden' : 'Anzeigen'}
				onclick={onToggleShowSum}
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
				class="relative flex flex-col items-center justify-center rounded-md border border-gray-200 px-2 py-3 text-sm font-semibold text-gray-800 shadow-sm dark:border-secondary-700 dark:text-gray-100"
			>
				{#if isFinished}
					{@const rank = podiumRanks.get(participant.playerId)}
					{#if rank}
						<div
							class="absolute right-0 bottom-0 translate-x-1/3 translate-y-1/2"
							title={`Platz ${rank}`}
						>
							<AwardOutline
								class="h-10 w-10 {rank === 1
									? 'text-yellow-500 dark:text-yellow-400'
									: rank === 2
										? 'text-gray-400 dark:text-gray-300'
										: 'text-amber-800 dark:text-amber-700'}"
							/>
						</div>
					{/if}
				{/if}
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
