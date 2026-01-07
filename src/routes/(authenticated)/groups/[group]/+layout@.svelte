<script lang="ts">
	import { Group } from '$lib/domain/group';
	import {
		Button,
		Tabs,
		TabItem,
		Modal,
		Label,
		Input,
		Helper,
		Alert,
		Dropdown,
		DropdownItem
	} from 'flowbite-svelte';
	import {
		ArrowLeftOutline,
		PlayOutline,
		ChartOutline,
		UsersGroupSolid,
		DotsVerticalOutline,
		EditOutline,
		ExclamationCircleSolid,
		TrashBinSolid
	} from 'flowbite-svelte-icons';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { enhance, applyAction } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';

	let { data, children } = $props();

	const group: Group | null = $derived(data.group);
	const groupId = $derived($page.params.group);

	let renameModal = $state(false);
	let newName = $state('');
	let deleteModal = $state(false);
	let deleteConfirmText = $state('');

	const tabs = [
		{ name: 'games', label: 'Spiele', icon: PlayOutline },
		{ name: 'statistics', label: 'Statistiken', icon: ChartOutline },
		{ name: 'players', label: 'Spieler', icon: UsersGroupSolid }
	];

	const pathParts = $page.url.pathname.split('/');
	const initialTab = pathParts[pathParts.length - 1] || 'games';
	let selected = $state(initialTab);

	const handleRenameSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
				renameModal = false;
				newName = '';
			}
			await applyAction(result);
		};
	};

	const handleDeleteGroup: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await goto('/groups');
			}
		};
	};

	const openRenameModal = () => {
		newName = group?.name || '';
		renameModal = true;
	};
</script>

<header class="bg-white shadow-sm">
	<div class="top-0 z-30 flex h-14 items-center px-2">
		<Button
			color="light"
			size="sm"
			class="flex h-10 w-10 items-center justify-center "
			pill={true}
			onclick={() => goto('/groups')}
			aria-label="Zurück"
		>
			<ArrowLeftOutline class="h-6 w-6" />
		</Button>
		<h1 class="flex-1 truncate text-center text-2xl font-semibold text-primary">
			{group ? group.name : ''}
		</h1>
		<Button
			color="light"
			size="sm"
			class="flex h-10 w-10 items-center justify-center"
			pill={true}
			aria-label="Gruppenmenü"
			id="group-menu"
		>
			<DotsVerticalOutline class="h-6 w-6" />
		</Button>
		<Dropdown simple triggeredBy="#group-menu">
			<DropdownItem onclick={openRenameModal}>
				<div class="flex items-center gap-2">
					<EditOutline class="h-4 w-4" />
					<span>Umbenennen</span>
				</div>
			</DropdownItem>
			<DropdownItem onclick={() => (deleteModal = true)}>
				<div class="flex items-center gap-2">
					<TrashBinSolid class="h-4 w-4" />
					<span>Löschen</span>
				</div>
			</DropdownItem>
		</Dropdown>
	</div>

	<!-- Tab Navigation -->
	<div class="top-14 z-20">
		<Tabs
			tabStyle="underline"
			classes={{ content: 'hidden' }}
			divider={false}
			bind:selected
			class="flex justify-center"
		>
			{#each tabs as tab}
				<TabItem key={tab.name} onclick={() => goto(`/groups/${groupId}/${tab.name}`)}>
					{#snippet titleSlot()}
						<div class="flex items-center gap-2">
							<tab.icon size="md" />
							{tab.label}
						</div>
					{/snippet}
				</TabItem>
			{/each}
		</Tabs>
	</div>
</header>

<div class="w-full p-4">
	{@render children()}
</div>
<Modal bind:open={renameModal} size="xs" autoclose={false}>
	<form method="POST" action="/groups/{groupId}/games?/rename" use:enhance={handleRenameSubmit}>
		<div class="flex flex-col space-y-4">
			<h3 class="text-xl font-medium text-gray-900 dark:text-white">Gruppe umbenennen</h3>

			{#if $page.form?.error}
				<Alert color="red">
					{#snippet icon()}
						<ExclamationCircleSolid class="h-5 w-5" />
					{/snippet}
					<span class="font-medium">Fehler</span>
					<div>{$page.form.error}</div>
				</Alert>
			{/if}

			<div>
				<Label for="groupName" class="mb-2">Neuer Gruppenname</Label>
				<input
					type="text"
					id="groupName"
					name="name"
					bind:value={newName}
					placeholder="Gruppenname eingeben"
					class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
					required
				/>
			</div>

			<div class="flex justify-end gap-3">
				<Button type="button" color="light" onclick={() => (renameModal = false)}>Abbrechen</Button>
				<Button type="submit">Umbenennen</Button>
			</div>
		</div>
	</form>
</Modal>

<Modal bind:open={deleteModal} size="xs" autoclose={false}>
	<form method="POST" action="/groups/{groupId}/games?/deleteGroup" use:enhance={handleDeleteGroup}>
		<div class="flex flex-col space-y-4">
			<h3 class="text-xl font-medium text-gray-900 dark:text-white">Gruppe löschen</h3>

			<Alert color="red">
				{#snippet icon()}
					<ExclamationCircleSolid class="h-5 w-5" />
				{/snippet}
				<div>
					Die Gruppe <strong>{group?.name}</strong> und alle zugehörigen Spieldaten werden dauerhaft gelöscht
					und können nicht wiederhergestellt werden.
				</div>
			</Alert>

			<div class="space-y-4">
				<div>
					<Input
						id="groupDeleteConfirm"
						type="text"
						bind:value={deleteConfirmText}
						autocomplete="off"
						aria-label="Gib den Namen der Gruppe ein, um zu bestätigen"
					/>
					<Helper>Bestätige, indem du den Gruppenname <strong>{group?.name}</strong> eingibst.</Helper>
				</div>

				<div class="flex justify-end gap-3">
					<Button
						type="button"
						color="light"
						onclick={() => {
							deleteModal = false;
							deleteConfirmText = '';
						}}>Abbrechen</Button
					>
					<Button type="submit" disabled={deleteConfirmText !== group?.name}>Gruppe löschen</Button>
				</div>
			</div>
		</div>
	</form>
</Modal>
