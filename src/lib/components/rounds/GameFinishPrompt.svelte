<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import type { GameParticipant } from '$lib/domain/game';

	export let isFinished: boolean;
	export let hasUpcomingRound: boolean;
	export let allMandatorySolosDone: boolean;
	export let remainingMandatorySoloPlayers: GameParticipant[];
	export let groupId: string;
	export let gameId: string;
	export let onStartAwardCeremony: () => void;
</script>

{#if !isFinished}
	{#if !hasUpcomingRound && allMandatorySolosDone}
		<div
			class="rounded-lg border border-primary bg-white p-4 shadow-sm dark:border-secondary-800 dark:bg-gray-800/60"
		>
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					Siegerehrung &amp; Spiel abschlie&#223;en
				</h3>
			</div>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
				Alle Runden sind gespielt. Wenn du das Spiel abschlie&#223;t k&#246;nnen Runden nicht mehr
				bearbeitet werden.
			</p>
			<div class="mt-3 flex justify-end">
				<Button type="button" color="primary" class="px-4 py-2" onclick={onStartAwardCeremony}
					>Siegerehrung starten</Button
				>
			</div>
			<form
				method="POST"
				action={`/groups/${groupId}/games/${gameId}?/finish`}
				class="mt-3 flex justify-end"
			>
				<Button outline type="submit" color="primary" class="px-4 py-2"
					>Spiel abschlie&#223;en</Button
				>
			</form>
		</div>
	{:else if !hasUpcomingRound && !allMandatorySolosDone}
		<div
			class="rounded-lg border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-700 dark:bg-gray-800/60"
		>
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Spiel abschlie&#223;en</h3>
			<p class="mt-1 text-sm text-amber-700 dark:text-amber-200">
				Pflichtsoli fehlen noch: {remainingMandatorySoloPlayers
					.map((p) => p.player?.displayName ?? 'Spieler')
					.join(', ')}
			</p>
		</div>
	{/if}
{/if}
