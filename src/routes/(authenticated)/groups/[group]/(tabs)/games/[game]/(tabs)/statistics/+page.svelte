<script lang="ts">
	import { LineChart, PieChart, BarChart } from 'layerchart';
	import { Card } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<div class="p-4 sm:p-6">
	<div class="mx-auto max-w-5xl">
		<!-- Simple flex row with wrapping and centered items -->
		<div class="mx-auto flex flex-wrap justify-center gap-2">
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Punktentwicklung</h3>

					<div
						class=" h-96 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
					>
						<LineChart
							data={data?.chart?.rows ?? []}
							x="round"
							series={data?.chart?.series ?? []}
							padding={{ top: 20, right: 20, bottom: 50, left: 20 }}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Durchschnittspunkte Paare
					</h3>

					<BarChart
						data={data.chart?.avgPairs ?? []}
						y="key"
						x="value"
						orientation="horizontal"
						padding={{ top: 20, right: 20, bottom: 20, left: 80 }}
					/>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Re Häufigkeit</h3>
					<div class="flex h-48 items-center justify-center">
						<PieChart legend data={data.chart?.pie ?? []} key="key" value="value" c="color" />
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Gewonnene Runden</h3>
					<div class="flex h-48 items-center justify-center">
						<PieChart legend data={data.chart?.winPie ?? []} key="key" value="value" c="color" />
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Durschnitt je Sieg vs. Niederlage
					</h3>
					<!-- <BarChart data={data.chart?.avgWinLoss ?? []} x="player" y="winAvg" /> -->
					<div class="flex h-60 items-center justify-center">
						<BarChart data={data.chart?.avgWinLoss ?? []} x="key" series={[{ key: 'winAvg', label:"Sieg", color: 'var(--color-primary)' }, { key: 'loseAvg', label:"Niederlage", color: 'var(--color-secondary)'}]}	 />
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>
