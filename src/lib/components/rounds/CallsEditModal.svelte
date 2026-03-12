<script lang="ts">
	import { Modal, Button, ButtonGroup, Label } from 'flowbite-svelte';
	import type { GameParticipant } from '$lib/domain/game';
	import type { CallTypeEnumValue, TeamEnumValue } from '$lib/domain/enums';
	import { CallType as CallTypeEnum, Team as TeamEnum } from '$lib/domain/enums';

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
</script>

<Modal bind:open size="xs" autoclose={false}>
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
				<Button type="button" color="primary" onclick={() => (open = false)}>Fertig</Button>
			</div>
		</div>
	{/if}
</Modal>
