<script lang="ts">
	import { LinkBreakOutline, PlusOutline, InfoCircleSolid, TrashBinOutline } from 'flowbite-svelte-icons';
	import { Button, Modal, Label, Input, Tabs, TabItem, Avatar, Alert } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import type { Player } from '$lib/domain/player';

	let { data, form }: PageProps = $props();

	let players = $derived(data.group?.players || []);
	let allPlayers = $derived(data.allPlayers || []);
	let availablePlayers = $derived(
		allPlayers.filter(
			(p: Player) => p.authProvider !== 'local' && !players.some((gp) => gp.id === p.id)
		)
	);

	let formModal = $state(false);
	let confirmDeleteModal = $state(false);
	let playerToDelete = $state<Player | null>(null);
</script>

<div class="pt-4 flex flex-col gap-4 items-center">
	{#if players.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Noch keine Spieler in dieser Gruppe.
		</p>
	{:else}
		<ul class="space-y-2 w-full max-w-xl pr-4 pl-4">
			{#each players as player}
				<li class="flex items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
					<div class="flex items-center space-x-4">
					<Avatar class="bg-secondary text-white">{player.displayName.charAt(0).toUpperCase()}</Avatar>
					<div class="space-y-1 font-medium dark:text-white">
						<div class="text-gray-900 dark:text-white">
							{player.displayName}
							</div>
							{#if player.authProvider === 'local'}
								<div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
									<LinkBreakOutline class="shrink-0 h-4 w-4" />
									Mit keinem Account verknüpft
								</div>
							{/if}
						</div>
					</div>
					{#if player.authProvider === 'local'}
						<Button
							color="red"
							outline={true}
							pill={true}
							size="xs"
							class="shrink-0"
							onclick={() => {
								playerToDelete = player;
								confirmDeleteModal = true;
							}}
						>
							<TrashBinOutline class="w-4 h-4" />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Button
	pill={true}
	class="fixed right-6 bottom-6 z-50 cursor-pointer p-2"
	onclick={() => (formModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={formModal} size="md">
	<div class="flex flex-col space-y-2">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler hinzufügen</h3>

		{#if form?.error}
			<Label color="red">{form.error}</Label>
		{/if}

		<Tabs tabStyle="underline" divider={false}>
			<TabItem open title="Angemeldeter Spieler">
				<form method="POST" action="?/addExisting" use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							formModal = false;
						}
					};
				}} class="mt-4">
					<div class="flex flex-col space-y-4">
						{#if availablePlayers.length === 0}
							<p class="text-sm text-gray-500 dark:text-gray-400">
								Keine verfügbaren Spieler mit Account gefunden.
							</p>
						{:else}
							<Label class="space-y-2">
								<span>Spieler auswählen</span>
								<select
									name="playerId"
									class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
									required
								>
									<option value="">Bitte wählen...</option>
									{#each availablePlayers as player}
									<option value={player.id}>{player.displayName}</option>
									{/each}
								</select>
							</Label>
							<div class="flex justify-end gap-3">
								<Button type="button" color="alternative" onclick={() => (formModal = false)}>
									Abbrechen
								</Button>
								<Button type="submit">Hinzufügen</Button>
							</div>
						{/if}
					</div>
				</form>
			</TabItem>

			<TabItem title="Lokaler Spieler">
				<form method="POST" action="?/createLocal" use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
							formModal = false;
						}
					};
				}}>
					<div class="flex flex-col space-y-4">
						<Label class="space-y-2">
							<span>Spielername</span>
							<Input type="text" name="playerName" placeholder="Name eingeben..." required />
						</Label>
						<Alert color="blue">
							{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
							<span class="font-medium">Lokale Spieler</span> existieren nur in dieser Gruppe und sind nicht mit einem Account verknüpft.
						</Alert>
						<div class="flex justify-end gap-3">
							<Button type="button" color="alternative" onclick={() => (formModal = false)}>
								Abbrechen
							</Button>
							<Button type="submit">Hinzufügen</Button>
						</div>
					</div>
				</form>
			</TabItem>
		</Tabs>
	</div>
</Modal>

<Modal bind:open={confirmDeleteModal} size="md" autoclose={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler entfernen</h3>
	<div class="space-y-4">
		<Alert color="red">
			{#snippet icon()}<TrashBinOutline class="h-5 w-5" />{/snippet}
			Lokaler Spiele <strong>{playerToDelete?.displayName}</strong> wird dauerhaft gelöscht und kann nicht wiederhergestellt werden.
		</Alert>
		<form method="POST" action="?/removePlayer" use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					await update();
					confirmDeleteModal = false;
					playerToDelete = null;
				}
			};
		}}>
			<input type="hidden" name="playerId" value={playerToDelete?.id} />
			<div class="flex justify-end gap-4">
				<Button color="alternative" onclick={() => {
					confirmDeleteModal = false;
					playerToDelete = null;
				}}>Abbrechen</Button>
				<Button color="red" type="submit">Ja, löschen</Button>
			</div>
		</form>
	</div>
</Modal>
