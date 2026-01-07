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

					<div class="flex h-80 items-center justify-center">
						<LineChart
							data={data?.chart?.rows ?? []}
							x="round"
							series={data?.chart?.series ?? []}
							props={{ spline: { draw: true } }}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Durchschnitt je Paar</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.chart?.avgPairs ?? []}
							y="key"
							x="value"
							orientation="horizontal"
							padding={{ top: 10, right: 10, bottom: 10, left: 120 }}
						/>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Re-Anteil</h3>
					<div class="flex h-50 items-center justify-center">
						<PieChart
							legend
							data={data.chart?.pie ?? []}
							key="key"
							value="value"
							c="color"
							props={{ pie: { motion: 'tween', sort: (a, b) => a.key.localeCompare(b.key) } }}
						/>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Gewonnene Runden</h3>
					<div class="flex h-50 items-center justify-center">
						<PieChart
							legend
							data={data.chart?.winPie ?? []}
							key="key"
							value="value"
							c="color"
							props={{ pie: { motion: 'tween', sort: (a, b) => a.key.localeCompare(b.key) } }}
						/>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Durschnitt je Sieg vs. Niederlage
					</h3>
					<!-- <BarChart data={data.chart?.avgWinLoss ?? []} x="player" y="winAvg" /> -->
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.chart?.avgWinLoss ?? []}
							x="key"
							props={{ bars: { motion: 'tween' } }}
							series={[
								{ key: 'winAvg', label: 'Sieg', color: 'var(--color-primary)' },
								{ key: 'loseAvg', label: 'Niederlage', color: 'var(--color-secondary)' }
							]}
							legend
						/>
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>
