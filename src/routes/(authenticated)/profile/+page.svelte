<script lang="ts">
	let { data } = $props();
	const user = $derived(data.user);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-semibold">Profil</h1>
		<p class="text-gray-600">Angemeldet via {user?.authProvider ?? 'unbekannt'}.</p>
	</div>

	<div class="rounded-lg border bg-white p-4 shadow-sm">
		<dl class="grid grid-cols-2 gap-3 text-sm">
			<dt class="text-gray-500">Name</dt>
			<dd class="text-gray-900">{user?.displayName}</dd>

			<dt class="text-gray-500">Handle</dt>
			<dd class="text-gray-900">{user?.name}</dd>
		</dl>
	</div>

	<form method="POST" action="/logout">
		<button
			type="submit"
			class="rounded-md bg-primary px-4 py-2 text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			Abmelden
		</button>
	</form>
</div>
