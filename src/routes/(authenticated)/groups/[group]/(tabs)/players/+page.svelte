<script lang="ts">
	import {
		LinkBreakOutline,
		PlusOutline,
		InfoCircleSolid,
		TrashBinOutline
	} from 'flowbite-svelte-icons';
	import {
		Button,
		Modal,
		Label,
		Input,
		Tabs,
		TabItem,
		Avatar,
		Alert,
		Helper
	} from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import type { Player } from '$lib/domain/player';
	import { AuthProvider } from '$lib/domain/enums';

	let { data, form }: PageProps = $props();

	let players = $derived(data.group?.players || []);

	let formModal = $state(false);
	let confirmDeleteModal = $state(false);
	let playerToDelete = $state<Player | null>(null);
</script>

<div class="flex flex-col items-center gap-4">
	<ul class="w-full max-w-xl space-y-2">
		{#each players as player}
			<li
				class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="flex items-center space-x-4">
					<Avatar class="bg-secondary text-white"
						>{player.displayName.charAt(0).toUpperCase()}</Avatar
					>
					<div class="space-y-1 font-medium dark:text-white">
						<div class="text-gray-900 dark:text-white">
							{player.displayName}
						</div>
						{#if player.authProvider == AuthProvider.Local}
							<div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
								<LinkBreakOutline class="h-4 w-4 shrink-0" />
								Mit keinem Account verknüpft
							</div>
						{/if}
					</div>
				</div>
				{#if player.authProvider == AuthProvider.Local}
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
						<TrashBinOutline class="h-4 w-4" />
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<Button
	pill={true}
	class="fixed right-6 bottom-6 z-50  p-2"
	onclick={() => (formModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={formModal} size="md">
	<div class="flex flex-col">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler hinzufügen</h3>

		<Tabs tabStyle="underline" divider={false}>
			<TabItem open title="Angemeldeter Spieler">
				<form
					method="POST"
					action="?/addExisting"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								formModal = false;
							}
						};
					}}
				>
					<div class="flex flex-col space-y-2">
						{#if form?.error}
							<Alert color="red">
								{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
								{form.error}
							</Alert>
						{/if}

						<Label for="username">Benutzername</Label>
						<Input
							id="username"
							type="text"
							name="username"
							placeholder="Benutzername eingeben..."
							required
						/>
						<Helper>
							Gib den Benutzernamen des Spielers ein, um ihn hinzuzufügen. Den Benutzernamen
							findest du auf der Profilseite des Spielers.
						</Helper>

						<div class="flex justify-end gap-3">
							<Button type="button" color="alternative" onclick={() => (formModal = false)}>
								Abbrechen
							</Button>
							<Button type="submit">Hinzufügen</Button>
						</div>
					</div>
				</form>
			</TabItem>

			<TabItem title="Lokaler Spieler">
				<form
					method="POST"
					action="?/createLocal"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								await update();
								formModal = false;
							}
						};
					}}
				>
					<div class="flex flex-col space-y-2">
						<Label for="playerName">Spielername</Label>
						<Input
							id="playerName"
							type="text"
							name="playerName"
							placeholder="Name eingeben..."
							required
						/>
						<Helper>
							Lokale Spieler sind nur in dieser Gruppe sichtbar und können nicht zu anderen Gruppen
							hinzugefügt werden.
						</Helper>
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
			Lokaler Spiele <strong>{playerToDelete?.displayName}</strong> wird dauerhaft gelöscht und kann nicht
			wiederhergestellt werden.
		</Alert>
		<form
			method="POST"
			action="?/removePlayer"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						await update();
						confirmDeleteModal = false;
						playerToDelete = null;
					}
				};
			}}
		>
			<input type="hidden" name="playerId" value={playerToDelete?.id} />
			<div class="flex justify-end gap-4">
				<Button
					color="alternative"
					onclick={() => {
						confirmDeleteModal = false;
						playerToDelete = null;
					}}>Abbrechen</Button
				>
				<Button color="red" type="submit">Ja, löschen</Button>
			</div>
		</form>
	</div>
</Modal>
