<script lang="ts">
	import { Chart, Axis, Layer, Spline, Circle, Text, Highlight, Tooltip } from 'layerchart';
	import { Card } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	// Color palette for different players
	const playerColors: Record<string, string> = {
		'#ef562f': '#ef562f',
		'#0284c7': '#0284c7',
		'#16a34a': '#16a34a',
		'#eab308': '#eab308'
	};

	// Create color assignments for each player
	const colors = Object.values(playerColors);
	const playerColorMap = $derived(
		(() => {
			const map = new Map<string, string>();
			data.data.forEach((series, index) => {
				map.set(series.series, colors[index % colors.length]);
			});
			return map;
		})()
	);

	// Flatten data for the chart
	const flatData = $derived(
		data.data.flatMap((series) =>
			series.data.map((point) => ({
				round: point.round,
				points: point.points,
				player: series.series
			}))
		)
	);

	// Group data by player for rendering
	const dataByPlayer = $derived(
		data.data.map((series) => [
			series.series,
			series.data.map((d) => ({ ...d, player: series.series }))
		])
	);
</script>

<div class="flex flex-row items-center p-4 sm:p-6">
	<section class="mx-auto w-full max-w-6xl space-y-6">
		<!-- Point Progression Chart -->
		<div>
			<Card class="h-full p-4 shadow-lg">
				<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Punktentwicklung</h3>

				<div
					class="h-96 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
				>
					<Chart
						data={flatData}
						x="round"
						y="points"
						yDomain={[null, null]}
						yNice
						c="player"
						cDomain={data.data.map((s) => s.series)}
						cRange={data.data.map((s) => playerColorMap.get(s.series) || '#666')}
						padding={32}
						tooltip={{ mode: 'quadtree' }}
					>
						{#snippet children({ context })}
							<Layer type="svg">
								<Axis placement="left" grid rule />
								<Axis placement="bottom" rule />
								{#each dataByPlayer as [player, playerData] (player)}
									{@const active =
										context.tooltip.data == null || context.tooltip.data.player === player}
									{@const color = context.cScale?.(player)}
									<g class={!active ? 'opacity-30 saturate-0 transition-opacity' : ''}>
										<Spline data={playerData} class="stroke-2" stroke={color}>
											{#snippet endContent()}
												<Circle r={4} fill={color} />
												<Text
													value={String(player)}
													verticalAnchor="middle"
													dx={6}
													dy={-2}
													class="text-xs font-medium"
													fill={color}
												/>
											{/snippet}
										</Spline>
									</g>
								{/each}
								<Highlight points lines />
							</Layer>
							<Tooltip.Root>
								<Tooltip.Header value={`Runde ${context.tooltip.data?.round}`} />
								<Tooltip.List>
									<Tooltip.Item
										label={context.tooltip.data?.player}
										value={context.tooltip.data?.points}
									/>
								</Tooltip.List>
							</Tooltip.Root>
						{/snippet}
					</Chart>
				</div>
			</Card>
		</div>
	</section>
</div>
