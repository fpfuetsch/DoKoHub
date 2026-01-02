<script lang="ts">
	import { Game } from '$lib/domain/game';

	let { data }: { data: { game: Game } } = $props();
	const game: Game = $derived(data.game);
</script>

<div class="p-6 flex flex-col gap-4">
	<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Statistiken</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400">
		Statistiken für dieses Spiel werden hier angezeigt. Aktuell {game.getRoundCount()} von {game.maxRoundCount} Runden erfasst.
	</p>
</div>
