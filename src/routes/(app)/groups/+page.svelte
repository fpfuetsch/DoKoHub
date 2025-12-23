<script lang="ts">
	import { Hr, Button, Modal, Label, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { Group } from '$lib/domain/group';
	import { formatDate } from '$lib/utils/format';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Rehydrate class instances
	const groups: Group[] = $derived(data.groups.map((g) => Group.fromJSON(g)));
	let formModal = $state(false);
	let groupName = $state('');
	let error = $state('');

	$effect(() => {
		if (form?.error) {
			error = form.error;
		} else if (form?.success) {
			formModal = false;
			groupName = '';
			error = '';
		}
	});
</script>

<div>
	{#if groups.length === 0}
		<p>Keine Gruppen gefunden.</p>
	{:else}
		<div class="h-auto overflow-auto">
			<ul>
				{#each groups as group}
					<a href={`/groups/${group.id}`} class="block">
						<li class="mb-4 rounded p-2 transition-colors duration-150 hover:bg-gray-100">
							<div class="text-lg font-bold">{group.name}</div>
							<div class="mb-1 text-sm text-gray-500">
								Erstellt am: {formatDate(group.createdAt)}
							</div>
							<div class="text-sm">
								Mitglieder:
								{#if group.players.length === 0}
									<span class="italic">Keine Mitglieder</span>
								{:else}
									<span>{group.players.map((p) => p.name).join(', ')}</span>
								{/if}
							</div>
						</li>
					</a>
					<Hr class="my-4" />
				{/each}
			</ul>
		</div>
	{/if}
</div>

<Button
	pill={true}
	class="fixed right-6 bottom-6 z-50 mb-16 cursor-pointer p-2"
	onclick={() => (formModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={formModal} size="xs" autoclose={false}>
	<form method="POST" action="?/create" use:enhance>
		<div class="flex flex-col space-y-6">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				Erstelle eine neue Gruppe
			</h3>
			{#if error}
				<Label color="red">{error}</Label>
			{/if}
			<Label class="space-y-2">
				<span>Gruppenname</span>
				<Input type="text" name="groupName" bind:value={groupName} required />
			</Label>
			<div class="flex justify-end gap-3">
				<Button type="submit">Erstellen</Button>
			</div>
		</div>
	</form>
</Modal>
