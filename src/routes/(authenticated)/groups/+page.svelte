<script lang="ts">
	import { Button, Modal, Label, Input, Alert } from 'flowbite-svelte';
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

<div class="flex flex-col items-center gap-4 pt-4">
	{#if groups.length === 0}
		<Alert class="w-full max-w-xl" color="secondary">
			{#snippet icon()}
				<InfoCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Du bist noch nicht Mitglied einer Gruppe.</span>
			<div>Erstelle eine neue Gruppe oder lass dich einladen.</div>
		</Alert>
	{:else}
		<ul class="w-full max-w-xl space-y-2 pr-4 pl-4">
			{#each groups as group}
				<a
					href="/groups/{group.id}"
					class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition cursor-pointer"
				>
					<div class="flex-1 space-y-1 font-medium dark:text-white">
						<div class="font-semibold text-gray-900 dark:text-white">
							{group.name}
						</div>
						<div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
							<div>
								<span class="font-medium">Erstellt am:</span>
								{formatDate(group.createdAt)}
							</div>
							<div>
								<span class="font-medium">Mitglieder:</span>
								{#if group.players.length === 0}
									<span class="italic">Keine Mitglieder</span>
								{:else}
									<span>{group.players.map((p) => p.displayName).join(', ')}</span>
								{/if}
							</div>
						</div>
					</div>
				</a>
			{/each}
		</ul>
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
