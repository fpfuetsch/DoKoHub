<script lang="ts">
	import { Modal, Progressradial } from 'flowbite-svelte';
	import { sineOut } from 'svelte/easing';
	import type { GameParticipant } from '$lib/domain/game';

	type AwardEntry = {
		playerId: string;
		name: string;
		points: number;
		place: number;
		medal: string;
	};

	let {
		open = $bindable(),
		sortedParticipants,
		playerTotals
	} = $props<{
		open: boolean;
		sortedParticipants: GameParticipant[];
		playerTotals: Map<string, number>;
	}>();

	const ranking = $derived(
		(() => {
			const rankedPlayers: Array<{ playerId: string; name: string; points: number }> =
				sortedParticipants
					.map((participant: GameParticipant) => ({
						playerId: participant.playerId,
						name: participant.player?.displayName ?? 'Spieler',
						points: playerTotals.get(participant.playerId) ?? 0
					}))
					.sort(
						(
							a: { playerId: string; name: string; points: number },
							b: { playerId: string; name: string; points: number }
						) => a.points - b.points || a.name.localeCompare(b.name)
					);

			const uniqueScoresAsc: number[] = Array.from(
				new Set(rankedPlayers.map((entry: { points: number }) => entry.points))
			).sort((a: number, b: number) => a - b);
			const scoreToPlace = new Map<number, number>();
			uniqueScoresAsc.forEach((score: number, index: number) => {
				scoreToPlace.set(score, uniqueScoresAsc.length - index);
			});

			return rankedPlayers.map(
				(entry: { playerId: string; name: string; points: number }, index: number) => {
					const place = scoreToPlace.get(entry.points) ?? rankedPlayers.length - index;
					const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '😬';
					return {
						...entry,
						place,
						medal
					};
				}
			);
		})()
	);

	let awardCeremonyStep = $state(0);
	let awardCeremonyCountdown = $state(10);
	let awardCeremonyProgress = $state(0);
	let showCeremonyPlace = $state(false);
	let showCeremonyPoints = $state(false);
	let showCeremonyName = $state(false);
	const awardCeremonyCountdownStart = 10;
	const awardCeremonyCountdownUpdateMs = 100;
	const awardCeremonyStepMs = 10000;
	const awardCeremonyRevealStartMs = 300;
	const awardCeremonyRevealGapMs = 1600;
	const awardCeremonyNameDelayAfterPointsMs = 2600;
	const awardCeremonyRevealDurationMs = 1400;
	const awardCeremonySwapFadeOutMs = 1200;
	type TrophyRainDrop = {
		left: string;
		delay: string;
		duration: string;
		size: string;
	};
	const awardCeremonyTrophyRainCount = 18;
	let awardCeremonyTrophyRain = $state<TrophyRainDrop[]>([]);

	const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

	const generateAwardCeremonyTrophyRain = (
		count = awardCeremonyTrophyRainCount
	): TrophyRainDrop[] =>
		Array.from({ length: count }, () => ({
			left: `${randomInRange(2, 98).toFixed(1)}%`,
			delay: `-${randomInRange(0.2, 7).toFixed(1)}s`,
			duration: `${randomInRange(6.7, 8.6).toFixed(1)}s`,
			size: `${Math.round(randomInRange(32, 41))}px`
		}));

	const maxAwardCeremonyStep = $derived(Math.max(0, ranking.length - 1));
	const currentAwardCeremonyEntry = $derived(ranking[awardCeremonyStep] ?? null);
	const isFirstPlaceCeremonyEntry = $derived(currentAwardCeremonyEntry?.place === 1);
	const shouldShowAwardCeremonyTrophyRain = $derived(isFirstPlaceCeremonyEntry && showCeremonyName);

	const resetAwardCeremonyProgress = () => {
		awardCeremonyCountdown = awardCeremonyCountdownStart;
		awardCeremonyProgress = 0;
	};

	const hideAwardCeremonyReveal = () => {
		showCeremonyPlace = false;
		showCeremonyPoints = false;
		showCeremonyName = false;
	};

	$effect(() => {
		if (!open) {
			hideAwardCeremonyReveal();
			return;
		}

		awardCeremonyStep = 0;
		resetAwardCeremonyProgress();
		awardCeremonyTrophyRain = generateAwardCeremonyTrophyRain();
	});

	$effect(() => {
		if (!open) return;
		if (awardCeremonyStep >= maxAwardCeremonyStep) {
			awardCeremonyCountdown = 0;
			awardCeremonyProgress = 100;
			return;
		}

		resetAwardCeremonyProgress();
		const start = Date.now();
		const countdownInterval = setInterval(() => {
			const elapsedMs = Math.min(awardCeremonyStepMs, Date.now() - start);
			const remainingMs = Math.max(0, awardCeremonyStepMs - elapsedMs);
			awardCeremonyCountdown = Math.ceil(remainingMs / 1000);
			awardCeremonyProgress = (elapsedMs / awardCeremonyStepMs) * 100;
		}, awardCeremonyCountdownUpdateMs);

		const hideTimer = setTimeout(() => {
			hideAwardCeremonyReveal();
		}, awardCeremonyStepMs - awardCeremonySwapFadeOutMs);

		const timer = setTimeout(() => {
			awardCeremonyStep = Math.min(awardCeremonyStep + 1, maxAwardCeremonyStep);
		}, awardCeremonyStepMs);

		return () => {
			clearInterval(countdownInterval);
			clearTimeout(hideTimer);
			clearTimeout(timer);
		};
	});

	$effect(() => {
		if (!open || !currentAwardCeremonyEntry) {
			hideAwardCeremonyReveal();
			return;
		}

		if (isFirstPlaceCeremonyEntry) {
			awardCeremonyTrophyRain = generateAwardCeremonyTrophyRain();
		}

		hideAwardCeremonyReveal();

		const placeTimer = setTimeout(() => {
			showCeremonyPlace = true;
		}, awardCeremonyRevealStartMs);

		const pointsTimer = setTimeout(() => {
			showCeremonyPoints = true;
		}, awardCeremonyRevealStartMs + awardCeremonyRevealGapMs);

		const nameTimer = setTimeout(
			() => {
				showCeremonyName = true;
			},
			awardCeremonyRevealStartMs + awardCeremonyRevealGapMs + awardCeremonyNameDelayAfterPointsMs
		);

		return () => {
			clearTimeout(placeTimer);
			clearTimeout(pointsTimer);
			clearTimeout(nameTimer);
		};
	});
</script>

<Modal bind:open fullscreen autoclose={false} size="none" classes={{ body: 'p-0' }}>
	<div class="relative flex h-dvh flex-col items-center justify-center overflow-hidden">
		{#if isFirstPlaceCeremonyEntry}
			<div
				class="pointer-events-none absolute inset-0 z-0 transition-opacity ease-out {shouldShowAwardCeremonyTrophyRain
					? 'opacity-100'
					: 'opacity-0'}"
				style={`transition-duration: ${awardCeremonyRevealDurationMs}ms;`}
			>
				{#each awardCeremonyTrophyRain as drop}
					<span
						class="trophy-rain"
						style={`left: ${drop.left}; animation-delay: ${drop.delay}; animation-duration: ${drop.duration}; font-size: ${drop.size};`}
						>🏆</span
					>
				{/each}
			</div>
		{/if}

		{#if currentAwardCeremonyEntry}
			<div class="relative z-10 flex flex-col items-center text-center">
				<p
					class="leading-none font-bold text-gray-700 transition-opacity ease-out dark:text-white {showCeremonyPlace
						? 'opacity-100'
						: 'opacity-0'}"
					style={`transition-duration: ${awardCeremonyRevealDurationMs}ms;`}
				>
					{#if currentAwardCeremonyEntry.place <= 3}
						<span class="text-[120px]">{currentAwardCeremonyEntry.medal}</span>
					{:else}
						<span class="text-[80px]">Platz {currentAwardCeremonyEntry.place}</span>
					{/if}
				</p>
				<p
					class="mt-5 text-[40px] font-semibold text-secondary transition-opacity ease-out dark:text-secondary-400 {showCeremonyPoints
						? 'opacity-100'
						: 'opacity-0'}"
					style={`transition-duration: ${awardCeremonyRevealDurationMs}ms;`}
				>
					{currentAwardCeremonyEntry.points}
					{Math.abs(currentAwardCeremonyEntry.points) === 1 ? ' Punkt' : ' Punkte'}
				</p>
				<p
					class="mt-15 text-[80px] font-semibold text-primary drop-shadow-sm transition-opacity ease-out dark:text-primary-400 {showCeremonyName
						? 'opacity-100'
						: 'opacity-0'}"
					style={`transition-duration: ${awardCeremonyRevealDurationMs}ms;`}
				>
					{currentAwardCeremonyEntry.name}
				</p>
			</div>
		{/if}

		<div class="fixed inset-x-0 bottom-4 flex justify-center">
			{#if awardCeremonyStep < maxAwardCeremonyStep}
				<div class="relative inline-flex items-center justify-center">
					<Progressradial
						size="h-14 w-14"
						progress={awardCeremonyProgress}
						animate
						precision={1}
						tweenDuration={300}
						easing={sineOut}
					/>
					<span
						class="pointer-events-none absolute text-base font-semibold text-gray-700 dark:text-gray-200"
						>{awardCeremonyCountdown}s</span
					>
				</div>
			{/if}
		</div>
	</div>
</Modal>

<style>
	.trophy-rain {
		position: absolute;
		top: -20%;
		opacity: 0.8;
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.15));
		animation-name: trophy-rain-fall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
	}

	@keyframes trophy-rain-fall {
		0% {
			transform: translate3d(0, -15vh, 0);
			opacity: 0;
		}
		8% {
			opacity: 0.85;
		}
		50% {
			transform: translate3d(0, 52vh, 0);
		}
		100% {
			transform: translate3d(0, 118vh, 0);
			opacity: 0;
		}
	}
</style>
