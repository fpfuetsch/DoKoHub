<script lang="ts">
	import { BarChart, PieChart } from 'layerchart';
	import { Card, Spinner, Alert } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let stats: any = $state(null);
	let error: any = $state(null);

	$effect(() => {
		data.statsPromise
			.then((calculated: any) => {
				stats = calculated;
				error = null;
			})
			.catch((err: any) => {
				console.error('Failed to load statistics:', err);
				error = err;
				stats = null;
			});
	});
</script>

<div class="mx-auto max-w-7xl">
	{#if error}
		<Alert color="secondary" class="mx-auto mb-8 w-full max-w-xl">
			{#snippet icon()}
				<InfoCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Fehler beim Laden der Statistiken.</span>
			<div>{error.message || 'Ein unerwarteter Fehler ist aufgetreten.'}</div>
		</Alert>
	{:else if data.finishedGamesCount === 0}
		<Alert color="secondary" class="mx-auto mb-8 w-full max-w-xl">
			{#snippet icon()}
				<InfoCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Noch keine Spiele beendet.</span>
			<div>Statistische Daten werden angezeigt, sobald das erste Spiel beendet wurde.</div>
		</Alert>
	{:else}
		<!-- Spiele Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Spiele</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- Spiele gespielt -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Spiele gespielt
						</h3>
						<div
							class="flex h-full flex-col items-center justify-center"
							style="aspect-ratio: 5 / 4;"
						>
							{#if !stats?.gamesTimeline || stats.gamesTimeline.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else if stats.gamesTimeline && stats.gamesTimeline.length > 0}
								<p class="text-[8rem] font-bold text-secondary-600 dark:text-secondary-400">
									{stats.gamesTimeline[stats.gamesTimeline.length - 1].games}
								</p>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Spiele gewonnen (Pie Chart) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Spiele gewonnen
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.gamesWon || stats.gamesWon.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<PieChart
									data={stats.gamesWon}
									key="player"
									value="value"
									props={{ pie: { motion: 'tween', sort: null } }}
									c="color"
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Durchschnittspunkte je Spiel -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Durchschnittspunkte je Spiel
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.avgTotalPointsPerGame}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<BarChart
									data={stats?.avgTotalPointsPerGame ?? []}
									x="player"
									series={stats?.playerSeries?.series ?? []}
									props={{ bars: { motion: 'tween' } }}
									legend={false}
								/>
							{/if}
						</div>
					</Card>
				</div>
			</div>
		</div>

		<!-- Runden Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Runden</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- Runden gespielt -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Runden gespielt
						</h3>
						<div
							class="flex h-full flex-col items-center justify-center"
							style="aspect-ratio: 5 / 4;"
						>
							{#if !stats?.roundsTimeline || stats.roundsTimeline.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else if stats.roundsTimeline && stats.roundsTimeline.length > 0}
								<p class="text-[8rem] font-bold text-secondary-600 dark:text-secondary-400">
									{stats.roundsTimeline[stats.roundsTimeline.length - 1].rounds}
								</p>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Runden gewonnen (Pie Chart) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Runden gewonnen
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.roundsWon || stats.roundsWon.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<PieChart
									data={stats.roundsWon}
									key="player"
									value="value"
									props={{ pie: { motion: 'tween', sort: null } }}
									c="color"
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Runden nach Rundentyp (Pie Chart) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Runden nach Typ
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.roundsByType || stats.roundsByType.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<PieChart
									data={stats.roundsByType}
									key="type"
									value="value"
									props={{ pie: { motion: 'tween', sort: null } }}
									c="color"
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Solo Typen (Pie Chart) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Solorunden nach Typ
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.soloRoundsByType || stats.soloRoundsByType.length === 0}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<PieChart
									data={stats.soloRoundsByType}
									key="type"
									value="value"
									padding={{ bottom: 32 }}
									props={{ pie: { motion: 'tween', sort: null } }}
									c="color"
									legend={{ classes: { items: 'gap-1', item: 'text-xs', swatch: 'size-2' } }}
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Siegrate nach Rundentyp -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Siegrate je Rundentyp
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.winLostShareByType}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<BarChart
									data={stats?.winLostShareByType ?? []}
									x="player"
									series={[
										{ key: 'normalWinShare', label: 'Normal', color: '#3b82f6' },
										{ key: 'hochzeitWinShare', label: 'Hochzeit', color: '#10b981' },
										{ key: 'soloWinShare', label: 'Solo', color: '#f59e0b' }
									]}
									seriesLayout="group"
									props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Ø Punkte je Rundentyp (Normal/Hochzeit/Solo) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Punkte je Rundentyp
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.avgPointsByGameType}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<BarChart
									data={stats?.avgPointsByGameType ?? []}
									x="player"
									series={[
										{ key: 'normal', label: 'Normal', color: '#3b82f6' },
										{ key: 'hochzeit', label: 'Hochzeit', color: '#10b981' },
										{ key: 'solo', label: 'Solo', color: '#f59e0b' }
									]}
									seriesLayout="group"
									props={{ bars: { motion: 'tween' } }}
									legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Re / Kontra Anteil -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Anteil Re / Kontra
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
									props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Team-Erfolgsrate (Re/Kontra Siegrate) -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Siegrate Re / Kontra
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.teamWinRates}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<BarChart
									data={stats?.teamWinRates ?? []}
									x="player"
									series={[
										{ key: 'reRate', label: 'Re', color: 'var(--color-amber-500)' },
										{ key: 'kontraRate', label: 'Kontra', color: 'var(--color-purple-500)' }
									]}
									seriesLayout="group"
									props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
									legend
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Re / Kontra Durchschnittspunkte -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Punkte Re / Kontra
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

				<!-- Durchschnittliche Augen im Team -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">Augen im Team</h3>
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
			</div>
		</div>

		<!-- An-und Absagen & Boni Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">
				An-/ Absagen & Boni
			</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- An-/Absagen Häufigkeit -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Häufigkeit An-/Absagen
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
									legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
								/>
							{/if}
						</div>
					</Card>
				</div>

				<!-- Bonuspunkte Häufigkeit -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Häufigkeit Bonuspunkte
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

		<!-- Team Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Spielerpaare</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- Häufigkeit Team-Paare -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">
							Häufigkeit je Paar
						</h3>
						<div class="flex w-full items-center justify-center" style="aspect-ratio: 5 / 4;">
							{#if !stats?.pairTeamCounts}
								<Spinner size="12" type="bars" color="primary" />
							{:else}
								<BarChart
									data={stats?.pairTeamCounts ?? []}
									y="key"
									x="value"
									series={[
										{ key: 'value', label: 'Runden zusammen', color: 'var(--color-teal-400)' }
									]}
									orientation="horizontal"
									padding={{ left: 120, bottom: 10 }}
								/>
							{/if}
						</div>
					</Card>
				</div>
				<!-- Durchschnittspunkte je Paar -->
				<div class="w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4">
					<Card class="h-full p-4 shadow-lg">
						<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">Punkte je Paar</h3>
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
			</div>
		</div>
	{/if}
</div>
