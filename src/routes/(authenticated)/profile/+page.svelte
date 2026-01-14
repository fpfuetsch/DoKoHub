<script lang="ts">
	import { Button, Label, Input, Helper, Alert, Toast } from 'flowbite-svelte';
	import { CheckCircleOutline } from 'flowbite-svelte-icons';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { slide } from 'svelte/transition';

	let { data, form }: PageProps = $props();
	const user = $derived(data.user);
	const authProviderDisplay = $derived(
		user?.authProvider
			? user.authProvider.toLowerCase().charAt(0).toUpperCase() +
					user.authProvider.toLowerCase().slice(1)
			: 'unbekannt'
	);
	let toastStatus = $state(false);
	let counter = $state(5);
	let displayNameInput = $derived(user?.displayName || '');

	function showSuccessToast() {
		toastStatus = true;
		counter = 5;
		timeout();
	}

	function timeout() {
		if (--counter > 0) return setTimeout(timeout, 1000);
		toastStatus = false;
	}
</script>

<div class="flex justify-center px-4">
	<div class="w-full max-w-md space-y-2">
		<div class="flex items-center justify-between">
			<h1 class="text-xl">Angemeldet über: <span class="font-bold">{authProviderDisplay}</span></h1>
			<form method="POST" action="/logout">
				<Button type="submit" size="sm" color="secondary">Abmelden</Button>
			</form>
		</div>
		<div class="my-4 h-px bg-gray-200 dark:bg-gray-700"></div>

		<h1 class="text-lg font-semibold">Profil bearbeiten</h1>
		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						showSuccessToast();
					}
					await update();
				};
			}}
			class="space-y-6"
		>
			<div class="space-y-4 bg-white">
				{#if form?.errors?.[0]}
					<Alert color="red">
						{form.errors[0]}
					</Alert>
				{/if}

				<Toast transition={slide} bind:toastStatus position="top-right" color="green">
					{#snippet icon()}
						<CheckCircleOutline
							class="h-6 w-6 bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-200"
						/>
					{/snippet}
					Erfolgreich gespeichert!
				</Toast>

				<div>
					<Label for="displayName">Anzeigename</Label>
					<Input
						id="displayName"
						type="text"
						name="displayName"
						bind:value={displayNameInput}
						required
					/>
					<Helper>Der Name, unter dem du anderen Spielern angezeigt wirst.</Helper>
				</div>
			</div>

			<div class="flex justify-end">
				<Button type="submit">Speichern</Button>
			</div>
		</form>
	</div>
</div>
