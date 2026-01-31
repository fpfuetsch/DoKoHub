<script lang="ts">
	import { BarChart, PieChart } from 'layerchart';
	import { Alert } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import StatsCard from '$lib/components/StatsCard.svelte';
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
	{:else if stats?.totalGames === 0}
		<Alert color="secondary" class="mx-auto mb-8 w-full max-w-xl">
			{#snippet icon()}
				<InfoCircleSolid class="h-5 w-5" />
			{/snippet}
			<span class="font-medium">Noch keine Spiele gespielt.</span>
			<div>
				Statistische Daten werden angezeigt, sobald du an deinem ersten Spiel teilgenommen hast.
			</div>
		</Alert>
	{:else}
		<!-- Spiele Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Spiele</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<StatsCard
					title="Spiele gespielt"
					loading={stats?.gamesPlayed == null}
					bodyClass="flex h-full flex-col items-center justify-center"
				>
					{#if stats?.gamesPlayed != null}
						<p
							class="animate-scale-in text-[8rem] font-bold text-secondary-600 dark:text-secondary-400"
						>
							{stats.gamesPlayed}
						</p>
					{/if}
				</StatsCard>

				<StatsCard title="Gewonnen / Verloren" loading={stats?.gamesPlayed == null}>
					<PieChart
						data={stats?.gamesPlayed != null
							? [
									{ type: 'Gewonnen', value: stats.gamesWon, color: '#10b981' },
									{ type: 'Verloren', value: stats.gamesPlayed - stats.gamesWon, color: '#ef4444' }
								]
							: []}
						key="type"
						value="value"
						props={{ pie: { motion: 'tween', sort: null } }}
						c="color"
						legend
					/>
				</StatsCard>

				<StatsCard
					title="Durchschnittliche Punkte pro Spiel"
					loading={stats?.avgPointsPerGame == null}
					bodyClass="flex h-full flex-col items-center justify-center"
				>
					{#if stats?.avgPointsPerGame != null}
						<p
							class="animate-scale-in text-[8rem] font-bold text-secondary-600 dark:text-secondary-400"
						>
							{Math.round(stats.avgPointsPerGame)}
						</p>
					{/if}
				</StatsCard>
			</div>
		</div>

		<!-- Runden Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Runden</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<StatsCard
					title="Runden gespielt"
					loading={stats?.totalRounds == null}
					bodyClass="flex h-full flex-col items-center justify-center"
				>
					{#if stats?.totalRounds != null}
						<p
							class="animate-scale-in text-[8rem] font-bold text-secondary-600 dark:text-secondary-400"
						>
							{stats.totalRounds}
						</p>
					{/if}
				</StatsCard>

				<StatsCard
					title="Gewonnen / Verloren"
					loading={stats?.totalRounds == null || !stats?.roundsWon}
				>
					{#if stats?.totalRounds != null && stats?.roundsWon && stats.roundsWon.length > 0}
						<PieChart
							data={[
								{ type: 'Gewonnen', value: stats.roundsWon[0]?.value ?? 0, color: '#10b981' },
								{
									type: 'Verloren',
									value: (stats.totalRounds ?? 0) - (stats.roundsWon[0]?.value ?? 0),
									color: '#ef4444'
								}
							]}
							key="type"
							value="value"
							props={{ pie: { motion: 'tween', sort: null } }}
							c="color"
							legend
						/>
					{/if}
				</StatsCard>

				<StatsCard
					title="Runden nach Typ"
					loading={!stats?.roundsByType || stats.roundsByType.length === 0}
				>
					<PieChart
						data={stats?.roundsByType ?? []}
						key="type"
						value="value"
						props={{ pie: { motion: 'tween', sort: null } }}
						c="color"
						legend
					/>
				</StatsCard>

				<StatsCard
					title="Solorunden nach Typ"
					loading={!stats?.soloRoundsByType || stats.soloRoundsByType.length === 0}
				>
					<PieChart
						data={stats?.soloRoundsByType ?? []}
						key="type"
						value="value"
						props={{ pie: { motion: 'tween', sort: null } }}
						padding={{ bottom: 50 }}
						c="color"
						legend={{
							classes: {
								root: 'w-full',
								items: 'gap-2 flex-wrap justify-center',
								item: 'text-xs',
								swatch: 'size-2'
							}
						}}
					/>
				</StatsCard>

				<StatsCard title="Siegesrate je Rundentyp" loading={!stats?.winLostShareByType}>
					<BarChart
						data={stats?.winLostShareByType ?? []}
						x="player"
						series={stats?.roundTypeSeries?.map((s: any) => ({
							key: s.key + 'WinShare',
							label: s.label,
							color: s.color
						})) ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						legend
					/>
				</StatsCard>

				<StatsCard title="Punkte je Rundentyp" loading={!stats?.avgPointsByGameType}>
					<BarChart
						data={stats?.avgPointsByGameType ?? []}
						x="player"
						series={stats?.roundTypeSeries ?? []}
						seriesLayout="group"
						props={{ xAxis: { tickLabelProps: { value: '' } }, bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Anteil je Solotyp" loading={!stats?.soloTypeShareByPlayer}>
					<BarChart
						data={stats?.soloTypeShareByPlayer ?? []}
						x="player"
						series={stats?.soloTypeSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						padding={{ bottom: 60, top: 5, left: 20 }}
						legend={{
							classes: {
								root: 'w-full',
								items: 'gap-1 flex-wrap justify-center',
								item: 'text-xs',
								swatch: 'size-2'
							}
						}}
					/>
				</StatsCard>

				<StatsCard title="Siegesrate je Solotyp" loading={!stats?.soloTypeWinRateByPlayer}>
					<BarChart
						data={stats?.soloTypeWinRateByPlayer ?? []}
						x="player"
						series={stats?.soloTypeSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						padding={{ bottom: 60, top: 5, left: 20 }}
						legend={{
							classes: {
								root: 'w-full',
								items: 'gap-1 flex-wrap justify-center',
								item: 'text-xs',
								swatch: 'size-2'
							}
						}}
					/>
				</StatsCard>

				<StatsCard title="Punkte je Solotyp" loading={!stats?.avgPointsBySoloType}>
					<BarChart
						data={stats?.avgPointsBySoloType ?? []}
						x="player"
						series={stats?.soloTypeSeries ?? []}
						seriesLayout="group"
						props={{ xAxis: { tickLabelProps: { value: '' } }, bars: { motion: 'tween' } }}
						padding={{ bottom: 60, top: 5, left: 10 }}
						legend={{
							classes: {
								root: 'w-full',
								items: 'gap-1 flex-wrap justify-center',
								item: 'text-xs',
								swatch: 'size-2'
							}
						}}
					/>
				</StatsCard>

				<StatsCard title="Anteil Re / Kontra" loading={!stats?.reKontraShare}>
					<BarChart
						data={stats?.reKontraShare ?? []}
						x="player"
						series={stats?.reKontraSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						legend
					/>
				</StatsCard>

				<StatsCard title="Siegesrate Re / Kontra" loading={!stats?.teamWinRates}>
					<BarChart
						data={stats?.teamWinRates ?? []}
						x="player"
						series={stats?.reKontraRateSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						legend
					/>
				</StatsCard>

				<StatsCard title="Punkte Re / Kontra" loading={!stats?.avgReKontra}>
					<BarChart
						data={stats?.avgReKontra ?? []}
						x="key"
						series={stats?.reKontraAvgSeries ?? []}
						seriesLayout="group"
						props={{ xAxis: { tickLabelProps: { value: '' } }, bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>
			</div>
		</div>

		<!-- An-und Absagen & Boni Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">
				An-/ Absagen & Boni
			</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- An-/Absagen Häufigkeit -->
				<StatsCard title="Häufigkeit An-/Absagen" loading={!stats?.callGrouped}>
					<BarChart
						data={stats?.callGrouped ?? []}
						x="player"
						series={stats?.callSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							bars: { motion: 'tween' },
							yAxis: { format: 'integer' }
						}}
						legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
					/>
				</StatsCard>

				<!-- Erfolgsrate An-/Absagen -->
				<StatsCard title="Erfolgsrate An-/Absagen" loading={!stats?.callSuccessRate}>
					<BarChart
						data={stats?.callSuccessRate ?? []}
						x="player"
						series={stats?.callSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							yAxis: { format: 'percentRound' },
							bars: { motion: 'tween' }
						}}
						legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
					/>
				</StatsCard>

				<!-- Bonuspunkte Häufigkeit -->
				<StatsCard title="Häufigkeit Bonuspunkte" loading={!stats?.bonusGrouped}>
					<BarChart
						data={stats?.bonusGrouped ?? []}
						x="player"
						series={stats?.bonusSeries ?? []}
						seriesLayout="group"
						props={{
							xAxis: { tickLabelProps: { value: '' } },
							bars: { motion: 'tween' },
							yAxis: { format: 'integer' }
						}}
						legend
					/>
				</StatsCard>
			</div>
		</div>
	{/if}
</div>
