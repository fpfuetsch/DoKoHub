<script lang="ts">
	import { LineChart, BarChart } from 'layerchart';
	import { Card, Spinner } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let stats: any = $state(null);

	$effect(() => {
		data.statsPromise
			.then((calculatedStats: any) => {
				stats = calculatedStats;
			})
			.catch((error: any) => {
				console.error('Failed to load statistics:', error);
			});
	});
</script>

<div class="p-4">
	<div class="mx-auto max-w-7xl">
		<!-- Simple flex row with wrapping and centered items -->
		<div class="mx-auto flex flex-wrap justify-center gap-1">
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Punkteentwicklung
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.playerSeries}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<LineChart
								data={stats?.playerSeries?.rows ?? []}
								x="round"
								series={stats?.playerSeries?.series ?? []}
								props={{ spline: { draw: true, strokeWidth: 3 } }}
								legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Gewonnen / Verloren Anteil
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.winLostShare}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.winLostShare ?? []}
								x="player"
								series={[
									{ key: 'wonShare', label: 'Gewonnen', color: 'var(--color-emerald-300)' },
									{ key: 'lostShare', label: 'Verloren', color: 'var(--color-rose-300)' }
								]}
								seriesLayout="group"
								props={{
									yAxis: { format: 'percentRound' },
									bars: { motion: 'tween' }
								}}
								legend
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Re / Kontra Anteil
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.reKontraShare}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.reKontraShare ?? []}
								x="player"
								series={[
									{ key: 'reShare', label: 'Re', color: 'var(--color-amber-500)' },
									{ key: 'kontraShare', label: 'Kontra', color: 'var(--color-purple-500)' }
								]}
								seriesLayout="group"
								props={{
									yAxis: { format: 'percentRound' },
									bars: { motion: 'tween' }
								}}
								legend
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Re / Kontra Durchschnittspunkte
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.avgReKontra}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.avgReKontra ?? []}
								x="key"
								series={[
									{ key: 'reAvg', label: 'Re', color: 'var(--color-amber-500)' },
									{ key: 'kontraAvg', label: 'Kontra', color: 'var(--color-purple-500)' }
								]}
								seriesLayout="group"
								props={{ bars: { motion: 'tween' } }}
								legend
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Durchschnittspunkte je Paar
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.avgPairs}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.avgPairs ?? []}
								y="key"
								x="value"
								series={[
									{ key: 'value', label: 'Durchschnittspunkte', color: 'var(--color-teal-400)' }
								]}
								orientation="horizontal"
								padding={{ left: 120, bottom: 10 }}
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Durchschnittliche Augen im Team
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.avgEyesGrouped}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.avgEyesGrouped ?? []}
								x="player"
								series={stats?.playerSeries?.series ?? []}
								props={{ yAxis: { format: 'integer' }, bars: { motion: 'tween' } }}
								legend={false}
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						An-/Absagen Häufigkeit
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.callGrouped}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.callGrouped ?? []}
								x="player"
								series={[
									{ key: 'RE', label: 'Re', color: 'var(--color-amber-500)' },
									{ key: 'KONTRA', label: 'Kontra', color: 'var(--color-purple-500)' },
									{ key: 'Keine90', label: 'K90', color: 'var(--color-sky-400)' },
									{ key: 'Keine60', label: 'K60', color: 'var(--color-sky-500)' },
									{ key: 'Keine30', label: 'K30', color: 'var(--color-sky-600)' },
									{ key: 'Schwarz', label: 'Schwarz', color: 'var(--color-gray-700)' }
								]}
								seriesLayout="group"
								props={{ bars: { motion: 'tween' }, yAxis: { format: 'integer' } }}
								legend={{ classes: { items: 'gap-1', item: 'text-sm\t', swatch: 'size-3' } }}
							/>
						{/if}
					</div>
				</Card>
			</div>
			<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
						Bonuspunkte Häufigkeit
					</h3>
					<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
						{#if !stats?.bonusGrouped}
							<Spinner size="12" type="bars" color="primary" />
						{:else}
							<BarChart
								data={stats?.bonusGrouped ?? []}
								x="player"
								series={[
									{ key: 'doko', label: 'Doppelkopf', color: 'var(--color-lime-500)' },
									{ key: 'fuchs', label: 'Fuchs', color: 'var(--color-red-500)' },
									{ key: 'karlchen', label: 'Karlchen', color: 'var(--color-cyan-500)' }
								]}
								seriesLayout="group"
								props={{ bars: { motion: 'tween' }, yAxis: { format: 'integer' } }}
								legend
							/>
						{/if}
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>
