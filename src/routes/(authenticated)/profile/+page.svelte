<script lang="ts">
	import { Button, Label, Input, Helper, Alert, Toast } from 'flowbite-svelte';
	import { CheckCircleOutline, OpenDoorOutline } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { page } from '$app/stores';

	let { data, form }: PageProps = $props();
	const user = $derived(data.user);
	const authProviderDisplay = $derived(
		user?.authProvider ? user.authProvider.charAt(0).toUpperCase() + user.authProvider.slice(1) : 'unbekannt'
	);
	let showSuccess = $state(false);

	const showSuccessIfUpdated = () => {
		if ($page.url.searchParams.has('updated')) {
			showSuccess = true;
			setTimeout(() => {
				showSuccess = false;
			}, 5000);
		}
	};

	$effect(() => {
		$page.url.searchParams;
		showSuccessIfUpdated();
	});
</script>

<div class="flex justify-center px-4">
	<div class="space-y-6 w-full max-w-md">
		<div class="flex justify-between items-center">
			<h1 class="text-xl">Angemeldet via <span class="font-bold">{authProviderDisplay}</span></h1>
			<form method="POST" action="/logout">
				<Button type="submit" size="sm" color="red" class="cursor-pointer">
					<OpenDoorOutline class="w-4 h-4 mr-2" />
					Abmelden
				</Button>
			</form>
		</div>

		<form method="POST" action="?/save" use:enhance={() => {
			return async ({ result, update }) => {
				await update();
			};
		}} class="space-y-6">
			<div class="bg-white p-4 space-y-4">
			{#if form?.message}
				<Alert color="red">
					{form.message}
				</Alert>
			{/if}
			{#if showSuccess}
				<Toast position="top-right" color="green">
					{#snippet icon()}
						<CheckCircleOutline class="text-green-600 bg-green-100 dark:bg-green-800 dark:text-green-200 h-6 w-6" />
					{/snippet}
					Deine Änderungen wurden erfolgreich gespeichert!
				</Toast>
			{/if}

			<div>
				<Label for="name">Benutzername</Label>
				<Input
					id="name"
					type="text"
					name="name"
					value={user?.name}
					required
				/>
				<Helper>Eindeutiger Benutzername für Verknüpfungen und Spielgruppen.</Helper>
				{#if form?.errors?.name}
					<Helper color="red">{form.errors.name[0]}</Helper>
				{/if}
			</div>
			<div>
				<Label for="displayName">Anzeigename</Label>
				<Input
					id="displayName"
					type="text"
					name="displayName"
					value={user?.displayName}
					required
				/>
				<Helper>Der angezeigte Name für andere Spieler.</Helper>
				{#if form?.errors?.displayName}
					<Helper color="red">{form.errors.displayName[0]}</Helper>
				{/if}
			</div>

		</div>

		<div class="flex justify-end">
			<Button type="submit" class="cursor-pointer">Änderungen speichern</Button>
		</div>
	</form>
	</div>
</div>
