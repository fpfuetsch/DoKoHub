<script lang="ts">
	import { Hr, Button, Modal, Label, Input, Alert } from 'flowbite-svelte';
	import { PlusOutline, InfoCircleSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { Group } from '$lib/domain/group';
	import { formatDate } from '$lib/utils/format';
	import { enhance, applyAction } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const groups: Group[] = $derived(data.groups);
	let formModal = $state(false);

	const handleGroupSubmit: SubmitFunction = () => {
		return async ({ result }) => {
			if (result.type === 'success') {
				await invalidateAll();
				formModal = false;
			}
			await applyAction(result);
		};
	};
</script>

<div>
	{#if groups.length === 0}
		<Alert class="mb-6" color="secondary">
			{#snippet icon()}
				<InfoCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Du bist noch nicht Mitglied einer Gruppe.</span>
			<div>Erstelle eine neue Gruppe oder lass dich einladen.</div>
		</Alert>
	{:else}
		<div class="h-auto overflow-auto">
			<ul>
				{#each groups as group}
					<a href={`/groups/${group.id}`} class="block">
						<li class="mb-4 rounded p-2 transition-colors duration-150 hover:bg-gray-100">
							<div class="text-lg font-bold truncate">{group.name}</div>
							<div class="mb-1 text-sm text-gray-500">
								Erstellt am: {formatDate(group.createdAt)}
							</div>
							<div class="text-sm">
								Mitglieder:
								{#if group.players.length === 0}
									<span class="italic">Keine Mitglieder</span>
								{:else}
									<span>{group.players.map((p) => p.displayName).join(', ')}</span>
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
	class="fixed right-6 bottom-6 z-50 mb-16  p-2"
	onclick={() => (formModal = true)}
>
	<PlusOutline class="h-10 w-10" />
</Button>

<Modal bind:open={formModal} size="xs" autoclose={false}>
	<form method="POST" action="?/create" use:enhance={handleGroupSubmit}>
		<div class="flex flex-col space-y-6">
			<h3 class="mb-4 text-xl font-medium text-gray-900 dark:text-white">
				Erstelle eine neue Gruppe
			</h3>
			{#if form?.error}
				<Alert color="red">
					{#snippet icon()}
						<ExclamationCircleSolid class="h-5 w-5" />
					{/snippet}
					<span class="font-medium">Fehler beim Erstellen</span>
					<div>{form.error}</div>
				</Alert>
			{/if}
			<Label class="space-y-2">
				<span>Gruppenname</span>
				<Input type="text" name="groupName" value={form?.values?.groupName ?? ''} required />
			</Label>
			<div class="flex justify-end gap-3">
				<Button type="submit" value="create">Erstellen</Button>
			</div>
		</div>
	</form>
</Modal>
