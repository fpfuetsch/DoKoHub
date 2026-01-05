<script lang="ts">
	import { Card, Label, Button, Alert, Input, Helper } from 'flowbite-svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const values = $derived({
		displayName: form?.values?.displayName ?? data.defaults?.displayName ?? '',
		name: form?.values?.name ?? data.defaults?.name ?? ''
	});

	const errors = $derived({
		displayName: form?.errors?.displayName?.[0],
		name: form?.errors?.name?.[0],
		message: form?.message as string | undefined
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-white px-4 py-8">
	<Card class="max-w-md p-4 border border-primary shadow-lg rounded-lg bg-white">
		<div class="space-y-4">
			<h1 class="text-center text-3xl font-semibold text-primary">Willkommen bei DoKoHub</h1>
			<p class="text-center text-gray-600">
				Wähle deinen Anzeigenamen und Benutzernamen.<br />
				Du kannst diese später in deinem Profil ändern.
			</p>

			{#if errors.message}
				<Alert color="red">{errors.message}</Alert>
			{/if}

			<form method="POST" use:enhance action="?/save" class="space-y-4">
				<div class="space-y-4">
					<div class="space-y-2">
						<Label for="name">Benutzername</Label>
						<Input
							id="name"
							name="name"
							required
							value={values.name}
							color={errors.name ? 'red' : undefined}
						/>
						{#if errors.name}
							<Helper color="red">{errors.name}</Helper>
						{:else}
							<Helper
								>Über deinen Benutzernamen können dich andere Spieler finden. (Erlaubt Zeichen sind
								Kleinbuchstaben, Zahlen, - und _)
							</Helper>
						{/if}
					</div>

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
						<Helper>Dein Anzeigename wird in Gruppen und Statistiken verwendet.</Helper>
					</div>

					<div class="flex justify-end">
						<Button type="submit">Speichern</Button>
					</div>
				</div>
			</form>
		</div>
	</Card>
</div>
