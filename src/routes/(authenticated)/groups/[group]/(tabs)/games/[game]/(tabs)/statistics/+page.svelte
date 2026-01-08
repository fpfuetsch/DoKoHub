<script lang="ts">
	import { LineChart, BarChart } from 'layerchart';
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
							data={data.stats?.playerSeries?.rows ?? []}
							x="round"
							series={data.stats?.playerSeries?.series ?? []}
							props={{ spline: { draw: true, strokeWidth: 3 } }}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Gewonnen vs. Verloren Anteil
					</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.stats?.winLostShare ?? []}
							x="player"
							series={[
								{ key: 'wonShare', label: 'Gewonnen', color: 'var(--color-emerald-300)' },
								{ key: 'lostShare', label: 'Verloren', color: 'var(--color-rose-300)' }
							]}
							seriesLayout="group"
							props={{
								xAxis: { format: 'none' },
								yAxis: { format: 'percentRound' },
								tooltip: { header: { format: 'none' } },
								bars: { motion: 'tween' }
							}}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Re vs. Kontra Anteil</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.stats?.reKontraShare ?? []}
							x="player"
							series={[
								{ key: 'reShare', label: 'Re', color: 'var(--color-amber-500)' },
								{ key: 'kontraShare', label: 'Kontra', color: 'var(--color-purple-500)' }
							]}
							seriesLayout="group"
							props={{
								xAxis: { format: 'none' },
								yAxis: { format: 'percentRound' },
								tooltip: { header: { format: 'none' } },
								bars: { motion: 'tween' }
							}}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Re vs. Kontra Durchschnittspunkte
					</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.stats?.avgReKontra ?? []}
							x="key"
							series={[
								{ key: 'reAvg', label: 'Re', color: 'var(--color-amber-500)' },
								{ key: 'kontraAvg', label: 'Kontra', color: 'var(--color-purple-500)' }
							]}
							seriesLayout="group"
							props={{ bars: { motion: 'tween' } }}
							legend
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Durchschnittspunkte je Paar
					</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.stats?.avgPairs ?? []}
							y="key"
							x="value"
							series={[{ key: 'value', label: 'Durchschnittspunkte', color: 'var(--color-teal-400)' }]}
							orientation="horizontal"
							padding={{ top: 10, right: 10, bottom: 10, left: 120 }}
						/>
					</div>
				</Card>
			</div>
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">
						Bonuspunkte Häufigkeit
					</h3>
					<div class="flex h-80 items-center justify-center">
						<BarChart
							data={data.stats?.bonusGrouped ?? []}
							x="player"
							series={[
								{ key: 'doko', label: 'Doppelkopf', color: 'var(--color-lime-500)' },
								{ key: 'fuchs', label: 'Fuchs', color: 'var(--color-red-500)' },
								{ key: 'karlchen', label: 'Karlchen', color: 'var(--color-cyan-500)' }
							]}
							seriesLayout="group"
							props={{ bars: { motion: 'tween' }, yAxis: { format: 'integer' }, }}
							legend
						/>
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>
