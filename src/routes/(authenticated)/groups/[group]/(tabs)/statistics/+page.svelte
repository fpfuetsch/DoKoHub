<script lang="ts">
	import { LineChart, BarChart, PieChart } from 'layerchart';
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
				<StatsCard
					title="Punkteentwicklung"
					loading={!stats}
					hide={stats && (!stats?.playerSeriesByGame || stats.playerSeriesByGame.rows.length === 0)}
				>
					<LineChart
						data={stats?.playerSeriesByGame?.rows ?? []}
						x="date"
						series={stats?.playerSeriesByGame?.series ?? []}
						props={{
							spline: { strokeWidth: 3 }
						}}
						legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
					/>
				</StatsCard>

				<StatsCard
					title="Spiele gespielt"
					loading={stats?.gamesCount == null}
					bodyClass="flex h-full flex-col items-center justify-center"
				>
					{#if stats?.gamesCount != null}
						<p
							class="animate-scale-in text-[8rem] font-bold text-secondary-600 dark:text-secondary-400"
						>
							{stats.gamesCount}
						</p>
					{/if}
				</StatsCard>

				<StatsCard
					title="Spiele gewonnen"
					loading={!stats?.gamesWon || stats.gamesWon.length === 0}
				>
					<PieChart
						data={stats.gamesWon}
						key="player"
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

				<StatsCard title="Durchschnittspunkte je Spiel" loading={!stats?.avgTotalPointsPerGame}>
					<BarChart
						data={stats?.avgTotalPointsPerGame ?? []}
						x="player"
						series={stats?.playerSeries?.series ?? []}
						props={{ bars: { motion: 'tween' } }}
						legend={false}
					/>
				</StatsCard>
			</div>
		</div>

		<!-- Runden Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Runden</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<StatsCard
					title="Runden gespielt"
					loading={stats?.roundsCount == null}
					bodyClass="flex h-full flex-col items-center justify-center"
				>
					{#if stats?.roundsCount != null}
						<p
							class="animate-scale-in text-[8rem] font-bold text-secondary-600 dark:text-secondary-400"
						>
							{stats.roundsCount}
						</p>
					{/if}
				</StatsCard>

				<StatsCard
					title="Runden gewonnen"
					loading={!stats?.roundsWon || stats.roundsWon.length === 0}
				>
					<PieChart
						data={stats.roundsWon}
						key="player"
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

				<StatsCard
					title="Runden nach Typ"
					loading={!stats?.roundsByType || stats.roundsByType.length === 0}
				>
					<PieChart
						data={stats.roundsByType}
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
						data={stats.soloRoundsByType}
						key="type"
						value="value"
						padding={{ bottom: 50 }}
						props={{ pie: { motion: 'tween', sort: null } }}
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

				<StatsCard title="Siegesgrate je Rundentyp" loading={!stats?.winLostShareByType}>
					<BarChart
						data={stats?.winLostShareByType ?? []}
						x="player"
						series={stats?.roundTypeSeries?.map((s: any) => ({
							key: s.key + 'WinShare',
							label: s.label,
							color: s.color
						})) ?? []}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Punkte je Rundentyp" loading={!stats?.avgPointsByGameType}>
					<BarChart
						data={stats?.avgPointsByGameType ?? []}
						x="player"
						series={stats?.roundTypeSeries ?? []}
						seriesLayout="group"
						props={{ bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Anteil je Solotyp" loading={!stats?.soloTypeShareByPlayer}>
					<BarChart
						data={stats?.soloTypeShareByPlayer ?? []}
						x="player"
						series={stats?.soloTypeSeries ?? []}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						padding={{ bottom: 60, left: 20 }}
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

				<StatsCard title="Siegesgrate je Solotyp" loading={!stats?.soloTypeWinRateByPlayer}>
					<BarChart
						data={stats?.soloTypeWinRateByPlayer ?? []}
						x="player"
						series={stats?.soloTypeSeries ?? []}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						padding={{ bottom: 60, left: 20 }}
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
						props={{ bars: { motion: 'tween' } }}
						padding={{ bottom: 60, left: 10 }}
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
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Siegesgrate Re / Kontra" loading={!stats?.teamWinRates}>
					<BarChart
						data={stats?.teamWinRates ?? []}
						x="player"
						series={stats?.reKontraRateSeries ?? []}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Punkte Re / Kontra" loading={!stats?.avgReKontra}>
					<BarChart
						data={stats?.avgReKontra ?? []}
						x="key"
						series={stats?.reKontraAvgSeries ?? []}
						seriesLayout="group"
						props={{ bars: { motion: 'tween' } }}
						legend
					/>
				</StatsCard>

				<StatsCard title="Augen im Team" loading={!stats?.avgEyesGrouped}>
					<BarChart
						data={stats?.avgEyesGrouped ?? []}
						x="player"
						series={stats?.playerSeries?.series ?? []}
						props={{ yAxis: { format: 'integer' }, bars: { motion: 'tween' } }}
						legend={false}
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
						props={{ bars: { motion: 'tween' }, yAxis: { format: 'integer' } }}
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
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
					/>
				</StatsCard>

				<StatsCard title="Verpasste An-/Absagen im Team" loading={!stats?.missedCallRate}>
					<BarChart
						data={stats?.missedCallRate ?? []}
						x="player"
						series={stats?.callSeries ?? []}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend={{ classes: { items: 'gap-1', item: 'text-sm', swatch: 'size-3' } }}
					/>
				</StatsCard>

				<StatsCard title="An-/Absagen F-Score" loading={!stats?.callFScore}>
					<BarChart
						data={stats?.callFScore ?? []}
						x="player"
						series={[{ key: 'fScore', label: 'F-Score', color: 'var(--color-teal-400)' }]}
						seriesLayout="group"
						props={{ yAxis: { format: 'percentRound' }, bars: { motion: 'tween' } }}
						legend={false}
					/>
				</StatsCard>

				<!-- Bonuspunkte Häufigkeit -->
				<StatsCard title="Häufigkeit Bonuspunkte" loading={!stats?.bonusGrouped}>
					<BarChart
						data={stats?.bonusGrouped ?? []}
						x="player"
						series={stats?.bonusSeries ?? []}
						seriesLayout="group"
						props={{ bars: { motion: 'tween' }, yAxis: { format: 'integer' } }}
						legend
					/>
				</StatsCard>
			</div>
		</div>

		<!-- Team Section -->
		<div class="mb-8">
			<h2 class="text-center text-xl font-bold text-gray-700 dark:text-white">Spielerpaare</h2>
			<div class="mx-auto flex flex-wrap justify-center gap-1">
				<!-- Häufigkeit Team-Paare -->
				<StatsCard title="Häufigkeit je Paar" loading={!stats?.pairTeamCounts}>
					<BarChart
						data={stats?.pairTeamCounts ?? []}
						y="key"
						x="value"
						series={[{ key: 'value', label: 'Runden zusammen', color: 'var(--color-teal-400)' }]}
						orientation="horizontal"
						padding={{ left: 120, bottom: 10 }}
						props={{ xAxis: { format: 'integer' } }}
					/>
				</StatsCard>
				<!-- Durchschnittspunkte je Paar -->
				<StatsCard title="Punkte je Paar" loading={!stats?.avgPairs}>
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
				</StatsCard>
			</div>
		</div>
	{/if}
</div>
