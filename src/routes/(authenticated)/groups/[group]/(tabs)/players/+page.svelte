<script lang="ts">
	import {
		LinkBreakOutline,
		PlusOutline,
		InfoCircleSolid,
		TrashBinOutline,
		DotsVerticalOutline,
		OpenDoorOutline,
		LinkOutline,
		ClipboardOutline,
		EnvelopeOutline,
		UserAddOutline
	} from 'flowbite-svelte-icons';
	import { QrCodeOutline } from 'flowbite-svelte-icons';
	import {
		Button,
		Modal,
		Label,
		Input,
		Helper,
		Tabs,
		TabItem,
		Avatar,
		Alert,
		Dropdown,
		DropdownItem,
		ButtonGroup
	} from 'flowbite-svelte';

	import { EditOutline } from 'flowbite-svelte-icons';
	import QRCode from '@castlenine/svelte-qrcode';
	import { Toast } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import type { Player } from '$lib/domain/player';
	import { AuthProvider } from '$lib/domain/enums';
	import { CheckCircleOutline } from 'flowbite-svelte-icons';
	import { slide } from 'svelte/transition';
	import logo from '$lib/assets/dokohub.png';

	let { data, form }: PageProps = $props();

	let players = $derived(data.group?.players || []);
	let currentUser = $derived(data.user);
	let currentUserPlayer = $derived(
		players.find((p) => p.authProvider !== AuthProvider.Local && p.id === currentUser?.id)
	);
	let isLastNonLocalMember = $derived(
		currentUserPlayer && players.filter((p) => p.authProvider !== AuthProvider.Local).length === 1
	);

	let formModal = $state(false);

	let confirmDeleteModal = $state(false);
	let confirmLeaveModal = $state(false);
	let takeoverModal = $state(false);
	let renamerModal = $state(false);
	let playerToRename = $state<Player | null>(null);
	let renameInput = $state('');
	let renameError = $state('');
	let playerToDelete = $state<Player | null>(null);
	let playerToTakeover = $state<Player | null>(null);
	let takeoverConfirmText = $state('');
	let deleteConfirmText = $state('');
	let leaveConfirmText = $state('');
	let takeoverError = $state('');
	let deleteError = $state('');

	let inviteUrl = $state<string | null>(null);
	let showQr = $state(false);
	let inviteFormat = $state<'link' | 'qr' | null>(null);

	function handleLinkClick(e: Event) {
		inviteFormat = 'link';
		if (inviteUrl) {
			e.preventDefault();
			showQr = false;
		}
	}

	function handleQrClick(e: Event) {
		inviteFormat = 'qr';
		if (inviteUrl) {
			e.preventDefault();
			showQr = true;
		}
	}

	let inviteToast = $state(false);
	let inviteToastCounter = $state(3);

	function showInviteToast() {
		inviteToast = true;
		inviteToastCounter = 3;
		inviteTimeout();
	}

	function inviteTimeout() {
		if (--inviteToastCounter > 0) return setTimeout(inviteTimeout, 1000);
		inviteToast = false;
	}

	$effect(() => {
		if (!formModal) {
			// close modal; clear inviteUrl
			inviteUrl = null;
			showQr = false;
		}
	});

	async function copyInvite() {
		const u = inviteUrl;
		if (!u) return;
		try {
			await navigator.clipboard.writeText(u);
			showInviteToast();
		} catch (e) {
			console.error('Copy failed', e);
		}
	}
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
					<div>
						<Button
							color="light"
							size="sm"
							class="flex h-10 w-10 items-center justify-center"
							pill={true}
							aria-label="Spieleraktionen"
							id={'player-menu-' + player.id}
						>
							<DotsVerticalOutline class="h-6 w-6" />
						</Button>
						<Dropdown simple triggeredBy={'#player-menu-' + player.id} class="list-none">
							<DropdownItem
								onclick={() => {
									playerToTakeover = player;
									takeoverModal = true;
									takeoverConfirmText = '';
									takeoverError = '';
								}}
							>
								<div class="flex items-center gap-2">
									<LinkOutline class="h-6 w-6" />
									<span>Account verknüpfen</span>
								</div>
							</DropdownItem>
							<DropdownItem
								onclick={() => {
									// Open rename modal
									playerToRename = player;
									renamerModal = true;
									renameInput = player.displayName;
								}}
							>
								<div class="flex items-center gap-2">
									<EditOutline class="h-6 w-6" />
									<span>Umbenennen</span>
								</div>
							</DropdownItem>
							<DropdownItem
								onclick={() => {
									playerToDelete = player;
									confirmDeleteModal = true;
								}}
							>
								<div class="flex items-center gap-2">
									<TrashBinOutline class="h-6 w-6" />
									<span>Löschen</span>
								</div>
							</DropdownItem>
						</Dropdown>
					</div>
				{:else if currentUserPlayer && player.id === currentUserPlayer.id}
					<Button
						color="light"
						pill={true}
						size="sm"
						class="flex h-10 w-10 items-center justify-center"
						onclick={() => {
							confirmLeaveModal = true;
							leaveConfirmText = '';
						}}
					>
						<OpenDoorOutline class="h-6 w-6" />
					</Button>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<Button
	pill={false}
	class="fixed right-6 bottom-6 z-50 rounded-2xl p-2 shadow-lg"
	onclick={() => (formModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={formModal} size="sm">
	<Toast
		transition={slide}
		bind:toastStatus={inviteToast}
		dismissable={false}
		position="top-right"
		color="green"
	>
		{#snippet icon()}
			<CheckCircleOutline
				class="h-6 w-6 bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200"
			/>
		{/snippet}
		Einladungslink kopiert!
	</Toast>
	<div class="flex flex-col">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler hinzufügen</h3>

		<Tabs tabStyle="underline" divider={false}>
			<TabItem title="Spieler einladen">
				{#snippet titleSlot()}
					<div class="flex items-center gap-2">
						<EnvelopeOutline size="md" />
						Spieler einladen
					</div>
				{/snippet}
				<div class="flex flex-col space-y-3">
					{#if inviteUrl}
						{#if showQr}
							<div class="flex w-full flex-col items-center gap-4">
								<div class="mt-2 flex items-center justify-center">
									<QRCode data={inviteUrl} logoPath={logo} waitForLogo logoSize={24} haveGappedModules={true} />
								</div>
								<Helper class="w-full text-center"
									>Lass andere Spieler den QR-Code scannen, um der Gruppe beizutreten.</Helper
								>
							</div>
						{:else}
							<div class="flex items-center justify-end gap-2">
								<div class="flex w-full flex-col gap-2">
									<div class="flex items-center gap-2">
										<Input
											id="inviteLink"
											value={inviteUrl ?? ''}
											readonly
											class="flex-1 bg-transparent"
										/>
										<div class="flex items-center gap-2">
											<Button
												color="secondary"
												size="sm"
												aria-label="Kopieren"
												onclick={copyInvite}
												class="p-2"
											>
												<ClipboardOutline class="mr-1 h-4 w-4" />
												Kopieren
											</Button>
										</div>
									</div>
									<Helper
										>Teile diesen Link mit den anderen Spielern, damit sie der Gruppe beitreten
										können.</Helper
									>
								</div>
							</div>
						{/if}
					{:else}
						<div class="text-sm text-gray-600">
							Erzeuge einen Einladungslink oder QR Code, um andere Spieler einzuladen.
						</div>
					{/if}
					<form
						method="POST"
						action="?/generateInvite"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									inviteUrl = result.data?.inviteUrl ? String(result.data.inviteUrl) : null;
									showQr = inviteFormat === 'qr';
								}
							};
						}}
					>
						<div class="flex justify-end gap-3">
							<ButtonGroup>
								<Button
									type="submit"
									color={inviteFormat === 'link' ? 'primary' : 'light'}
									aria-label="Generate link"
									onclick={handleLinkClick}
								>
									<LinkOutline class="mr-1 h-4 w-4" />
									Link
								</Button>
								<Button
									type="submit"
									color={inviteFormat === 'qr' ? 'primary' : 'light'}
									aria-label="Generate QR"
									onclick={handleQrClick}
								>
									<QrCodeOutline class="mr-1 h-4 w-4" />
									QR Code
								</Button>
							</ButtonGroup>
						</div>
					</form>
				</div>
			</TabItem>

			<TabItem title="Lokaler Spieler">
				{#snippet titleSlot()}
					<div class="flex items-center gap-2">
						<UserAddOutline size="md" />
						Lokalen Spieler hinzufügen
					</div>
				{/snippet}
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

<Modal bind:open={takeoverModal} size="sm" autoclose={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Lokalen Spieler verknüpfen</h3>
	<div class="space-y-4">
		<Alert color="orange">
			{#snippet icon()}<LinkBreakOutline class="h-5 w-5" />{/snippet}
			<div>
				<div>
					Der lokale Spieler <strong>{playerToTakeover?.displayName}</strong> kann von deinem Account
					übernommen werden.
				</div>

				<div class="pt-2">
					Alle zugehörigen Daten des lokalen Spielers (Spiele, Runden, Ergebnisse, Boni usw.) werden
					dadurch auf dich übertragen.
				</div>
				<div class="pt-2">
					<strong>Dieser Vorgang kann nicht rückgängig gemacht werden!</strong>
				</div>
			</div>
		</Alert>
		<form
			method="POST"
			action="?/takeoverLocal"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						takeoverModal = false;
						playerToTakeover = null;
						takeoverConfirmText = '';
						takeoverError = '';
					} else {
						// If action returned an error, populate takeoverError from form
						takeoverError =
							result.type === 'failure' && result.data?.error ? String(result.data.error) : '';
					}
				};
			}}
		>
			{#if takeoverError}
				<Alert color="red" class="mb-4">
					{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
					{takeoverError}
				</Alert>
			{/if}
			<input type="hidden" name="localPlayerId" value={playerToTakeover?.id} />
			<div class="space-y-2">
				<Label for="takeoverConfirm">Bestätigung</Label>
				<Input
					id="takeoverConfirm"
					type="text"
					bind:value={takeoverConfirmText}
					autocomplete="off"
					aria-label="Gib den Namen des lokalen Spielers ein, um zu übernehmen"
					placeholder="Name des lokalen Spielers eingeben..."
				/>
				<Helper
					>Gib den Namen des lokalen Spielers <strong>{playerToTakeover?.displayName}</strong> ein, um
					die Übernahme zu bestätigen.</Helper
				>
			</div>
			<div class="mt-4 flex justify-end gap-4">
				<Button
					type="button"
					color="alternative"
					onclick={() => {
						takeoverModal = false;
						playerToTakeover = null;
						takeoverConfirmText = '';
					}}>Abbrechen</Button
				>
				<Button type="submit" disabled={takeoverConfirmText !== playerToTakeover?.displayName}
					>Übernehmen</Button
				>
			</div>
		</form>
	</div>
</Modal>

<Modal bind:open={renamerModal} size="sm" autoclose={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler umbenennen</h3>
	<div class="space-y-4">
		<form
			method="POST"
			action="?/renameLocal"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						renamerModal = false;
						playerToRename = null;
						renameInput = '';
						renameError = '';
					} else {
						if (result.type === 'failure') {
							// Prefer structured field errors
							const errs: any = result.data?.errors;
							if (errs && errs.displayName && errs.displayName.length > 0) {
								renameError = String(errs.displayName[0]);
							} else if (result.data?.error) {
								renameError = String(result.data.error);
							} else if (form?.error) {
								renameError = String(form.error);
							} else {
								renameError = 'Fehler beim Umbenennen.';
							}
						} else {
							renameError = form?.error ? String(form.error) : 'Fehler beim Umbenennen.';
						}
					}
				};
			}}
		>
			{#if renameError}
				<Alert color="red" class="mb-4">
					{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
					{renameError}
				</Alert>
			{/if}
			<input type="hidden" name="playerId" value={playerToRename?.id} />
			<div>
				<Label for="renameInput">Neuer Anzeigename</Label>
				<Input id="renameInput" name="displayName" bind:value={renameInput} required />
				<Helper>Gib einen neuen Anzeigenamen für den lokalen Spieler ein.</Helper>
			</div>
			<div class="mt-4 flex justify-end gap-4">
				<Button
					type="button"
					color="alternative"
					onclick={() => {
						renamerModal = false;
						playerToRename = null;
						renameInput = '';
					}}>Abbrechen</Button
				>
				<Button type="submit" disabled={renameInput.trim() === ''}>Umbenennen</Button>
			</div>
		</form>
	</div>
</Modal>

<Modal bind:open={confirmDeleteModal} size="sm" autoclose={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Spieler entfernen</h3>
	<div class="space-y-4">
		<Alert color="red">
			{#snippet icon()}<TrashBinOutline class="h-5 w-5" />{/snippet}
			Lokaler Spieler <strong>{playerToDelete?.displayName}</strong> wird dauerhaft gelöscht und kann
			nicht wiederhergestellt werden.
		</Alert>
		<form
			method="POST"
			action="?/removeLocalPlayer"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						confirmDeleteModal = false;
						playerToDelete = null;
						deleteConfirmText = '';
						deleteError = '';
					} else {
						deleteError =
							result.type === 'failure' && result.data?.error
								? String(result.data.error)
								: form?.error
									? String(form.error)
									: 'Fehler beim Löschen.';
					}
				};
			}}
		>
			{#if deleteError}
				<Alert color="red" class="mb-4">
					{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
					{deleteError}
				</Alert>
			{/if}
			<input type="hidden" name="playerId" value={playerToDelete?.id} />
			<div class="space-y-4">
				<div>
					<Input
						id="deleteConfirm"
						type="text"
						bind:value={deleteConfirmText}
						autocomplete="off"
						aria-label="Gib den Namen des Spielers ein, um zu bestätigen"
					/>
					<Helper
						>Bestätige, indem du den Namen des Spielers <strong
							>{playerToDelete?.displayName}</strong
						> eingibst.</Helper
					>
				</div>
				<div class="flex justify-end gap-4">
					<Button
						color="alternative"
						onclick={() => {
							confirmDeleteModal = false;
							playerToDelete = null;
							deleteConfirmText = '';
						}}>Abbrechen</Button
					>
					<Button
						color="red"
						type="submit"
						disabled={deleteConfirmText !== playerToDelete?.displayName}
					>
						Ja, löschen
					</Button>
				</div>
			</div>
		</form>
	</div>
</Modal>

<Modal bind:open={confirmLeaveModal} size="sm" autoclose={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Gruppe verlassen</h3>
	<div class="space-y-4">
		<Alert color="red">
			{#snippet icon()}<OpenDoorOutline class="h-5 w-5" />{/snippet}
			{#if isLastNonLocalMember}
				Du bist das letzte angemeldete Mitglied der Gruppe <strong>{data.group?.name}</strong>. Wenn
				du die Gruppe verlässt, wird sie dauerhaft gelöscht und alle zugehörigen Spieldaten sowie
				lokale Spieler gehen verloren.
			{:else}
				Wenn du die Gruppe <strong>{data.group?.name}</strong> verlässt, hast du danach keinen Zugriff
				mehr auf die zugehörigen Spieldaten.
			{/if}
		</Alert>
		<form
			method="POST"
			action="?/leaveGroup"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						await goto('/groups');
					}
				};
			}}
		>
			<div class="space-y-4">
				<div>
					<Input
						id="leaveConfirm"
						type="text"
						bind:value={leaveConfirmText}
						autocomplete="off"
						aria-label="Gib den Namen der Gruppe ein, um zu bestätigen"
					/>
					<Helper
						>Bestätige, indem du den Gruppennamen <strong>{data.group?.name}</strong> eingibst.</Helper
					>
				</div>
				<div class="flex justify-end gap-4">
					<Button
						color="alternative"
						onclick={() => {
							confirmLeaveModal = false;
							leaveConfirmText = '';
						}}>Abbrechen</Button
					>
					<Button color="red" type="submit" disabled={leaveConfirmText !== data.group?.name}>
						Gruppe verlassen
					</Button>
				</div>
			</div>
		</form>
	</div>
</Modal>
