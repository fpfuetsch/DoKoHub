<script lang="ts">
	import { Card, Label, Button, Alert, Input, Helper } from 'flowbite-svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const values = $derived({
		displayName: String(form?.values?.displayName ?? data.defaults?.displayName ?? '')
	});

	const errors = $derived({
		displayName: form?.errors?.displayName?.[0],
		message: form?.message as string | undefined
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-white">
	<Card class="m-4 w-full max-w-md rounded-lg border border-primary bg-white p-8 shadow-lg">
		<div class="space-y-4">
			<h1 class="text-3xl text-center font-semibold">
				Willkommen bei <span class="text-primary">DoKo</span><span class="text-secondary">Hub</span>
			</h1>
			<p class="text-center text-gray-600">Wähle deinen Anzeigename.</p>

			{#if errors.message}
				<Alert color="red">{errors.message}</Alert>
			{/if}

			<form method="POST" use:enhance action="?/save" class="space-y-4">
				<div class="space-y-4">
					<div class="space-y-2">
						<Label for="displayName">Anzeigename</Label>
						<Input
							id="displayName"
							name="displayName"
							required
							value={values.displayName}
							color={errors.displayName ? 'red' : undefined}
						/>
						{#if errors.displayName}
							<Helper color="red">{errors.displayName}</Helper>
						{/if}
						<Helper>Dein Anzeigename wird in Gruppen und Statistiken verwendet. Du kannst ihn jederzeit in deinem Profil ändern.</Helper>
					</div>

					<div class="flex justify-end">
						<Button type="submit">Speichern</Button>
					</div>
				</div>
			</form>
		</div>
	</Card>
</div>
