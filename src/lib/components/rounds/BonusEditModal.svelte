<script lang="ts">
	import { Modal, Button, ButtonGroup, Label } from 'flowbite-svelte';
	import type { GameParticipant } from '$lib/domain/game';
	import type { CallTypeEnumValue, TeamEnumValue } from '$lib/domain/enums';
	import { PlusOutline, MinusOutline } from 'flowbite-svelte-icons';

	export let open: boolean;
	export let editingPlayerId: string | null;
	export let sortedParticipants: GameParticipant[];
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
	export let bonusesAllowed: boolean;
</script>

<Modal bind:open size="xs" autoclose={false}>
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
							color={playerData.bonus.karlchen === false ? 'secondary' : 'light'}
							class="flex-1 "
							onclick={() => {
								playerData.bonus.karlchen = false;
							}}
						>
							Nein
						</Button>
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
					</ButtonGroup>
				</div>
			</div>

			<div class="mt-2 flex justify-end gap-3">
				<Button type="button" color="primary" onclick={() => (open = false)}>Fertig</Button>
			</div>
		</div>
	{/if}
</Modal>
