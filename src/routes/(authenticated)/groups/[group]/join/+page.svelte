<script lang="ts">
	import { Card, Button, Alert } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';

	let { data, form } = $props();
	const invalid = $derived(!data?.valid);
</script>

<div class="flex min-h-screen items-center justify-center bg-white px-4 py-8">
	<Card class="max-w-md rounded-lg border border-primary bg-white p-4 shadow-lg">
		{#if invalid}
			<div class="space-y-4">
				<h2 class="text-center text-2xl font-semibold text-primary">Ungültiger Einladungslink</h2>
				<Alert color="red" class="mb-4">
					{#snippet icon()}
						<InfoCircleSolid class="h-5 w-5" />
					{/snippet}
					Der Einladungslink ist ungültig oder abgelaufen.
				</Alert>
				<div class="flex justify-end gap-3">
					<Button type="button" color="primary" onclick={() => goto(`/groups`)}>Weiter</Button>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				<h1 class="text-center text-2xl font-semibold text-primary">Gruppe beitreten</h1>
				<p class="text-center text-gray-600">
					Du wurdest eingeladen, der Gruppe <strong>{data.groupName}</strong> beizutreten.
				</p>

				<form method="POST" action="?/accept" use:enhance class="space-y-4">
					<input type="hidden" name="token" value={data.token} />

					{#if form?.error}
						<Alert color="red">{form.error}</Alert>
					{/if}

					<div class="flex justify-end gap-3">
						<Button type="button" color="light" onclick={() => goto(`/groups`)}>Abbrechen</Button>
						<Button type="submit">Beitreten</Button>
					</div>
				</form>
			</div>
		{/if}
	</Card>
</div>
