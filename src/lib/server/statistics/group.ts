import { Team, BonusType, CallType, RoundType } from '$lib/domain/enums';
import type { Game } from '$lib/domain/game';
import { GameRepository } from '$lib/server/repositories/game';
import { error } from '@sveltejs/kit';

export interface GroupStatistics {
	// Reused structures
	playerSeries: {
		rows: Record<string, number | null>[];
		series: Array<{ key: string; label: string; color?: string }>;
	};
	reKontraShare: Array<{ player: string; reShare: number; kontraShare: number; color?: string }>;
	winLostShareByType: Array<{
		player: string;
		normalWinShare: number;
		hochzeitWinShare: number;
		soloWinShare: number;
		color?: string;
	}>;
	avgReKontra: Array<{ key: string; reAvg: number; kontraAvg: number; color?: string }>;
	avgPairs: Array<{ key: string; value: number; color?: string }>;
	pairTeamCounts: Array<{ key: string; value: number; color?: string }>;
	bonusGrouped: Array<{
		player: string;
		doko: number;
		fuchs: number;
		karlchen: number;
		color?: string;
	}>;
	avgEyesGrouped: Array<Record<string, any>>;
	avgEyes: Array<{ player: string; avgEyes: number; color?: string }>;
	callGrouped: Array<{
		player: string;
		RE: number;
		KONTRA: number;
		Keine90: number;
		Keine60: number;
		Keine30: number;
		Schwarz: number;
		color?: string;
	}>;

	// Group-only structures
	gamesPlayed: Array<Record<string, any>>;
	gamesWon: Array<{ player: string; value: number; percent: number; color?: string }>;
	roundsPlayed: Array<Record<string, any>>;
	roundsWon: Array<{ player: string; value: number; percent: number; color?: string }>;
	roundsTimeline: Array<{ date: string; rounds: number }>;
	avgTotalPointsPerGame: Array<Record<string, any>>;
	gamesTimeline: Array<{ date: string; games: number }>;
	consistency: Array<{ player: string; stdev: number; color?: string }>;
	teamWinRates: Array<{ player: string; reRate: number; kontraRate: number; color?: string }>;
	avgPointsByGameType: Array<{
		player: string;
		normal: number;
		hochzeit: number;
		solo: number;
		color?: string;
	}>;
	roundsByType: Array<{ type: string; value: number; percent: number }>;
	soloRoundsByType: Array<{ type: string; value: number; percent: number; color?: string }>;
}

const playerColorPalette = ['#ef562f', '#0284c7', '#16a34a', '#eab308', '#000000'];
// normal, hochzeit, solo colors
const roundTypeColorPalette = ['#3b82f6', '#10b981', '#f59e0b'];
const soloTypeOrder = [
	RoundType.SoloBuben,
	RoundType.SoloDamen,
	RoundType.SoloAss,
	RoundType.SoloKreuz,
	RoundType.SoloPik,
	RoundType.SoloHerz,
	RoundType.SoloKaro
];
const soloTypeLabels: Record<RoundType, string> = {
	[RoundType.SoloDamen]: 'Damen',
	[RoundType.SoloBuben]: 'Buben',
	[RoundType.SoloKreuz]: '♣️',
	[RoundType.SoloPik]: '♠️',
	[RoundType.SoloHerz]: '♥️',
	[RoundType.SoloKaro]: '♦️',
	[RoundType.SoloAss]: 'Ass',
	[RoundType.Normal]: 'Normal',
	[RoundType.HochzeitNormal]: 'Hochzeit Normal',
	[RoundType.HochzeitStill]: 'Hochzeit Still',
	[RoundType.HochzeitUngeklaert]: 'Hochzeit Ungeklärt'
};
const soloTypeColors: Record<RoundType, string> = {
	[RoundType.SoloBuben]: '#0f766e',
	[RoundType.SoloDamen]: '#a855f7',
	[RoundType.SoloAss]: '#22c55e',
	[RoundType.SoloKreuz]: '#0ea5e9',
	[RoundType.SoloPik]: '#2563eb',
	[RoundType.SoloHerz]: '#ef4444',
	[RoundType.SoloKaro]: '#fb923c',
	[RoundType.Normal]: '#000000',
	[RoundType.HochzeitNormal]: '#000000',
	[RoundType.HochzeitStill]: '#000000',
	[RoundType.HochzeitUngeklaert]: '#000000'
};

const increment = <K>(map: Map<K, number>, key: K, delta = 1) => {
	map.set(key, (map.get(key) || 0) + delta);
};

export function calculateGroupStatistics(games: Game[]): GroupStatistics {
	// Only count finished games
	const finishedGames = games.filter((g) => g.isFinished());

	// Build player list and color map across all finished games
	const playerMap = new Map<string, { id: string; name: string }>();
	for (const g of finishedGames) {
		for (const p of g.participants || []) {
			if (!p.player) continue;
			playerMap.set(p.player.id, {
				id: p.player.id,
				name: p.player.getTruncatedDisplayName() || 'Unknown'
			});
		}
	}
	const players = Array.from(playerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	const playerColorMap = new Map<string, string>();
	players.forEach((pl, idx) =>
		playerColorMap.set(pl.id, playerColorPalette[idx % playerColorPalette.length])
	);

	// Aggregates
	const reCounts = new Map<string, number>();
	const kontraCounts = new Map<string, number>();
	const normalWins = new Map<string, number>();
	const normalTotal = new Map<string, number>();
	const hochzeitWins = new Map<string, number>();
	const hochzeitTotal = new Map<string, number>();
	const soloWins = new Map<string, number>();
	const soloTotal = new Map<string, number>();
	const reTotals = new Map<string, number>();
	const reCountsMap = new Map<string, number>();
	const kontraTotals = new Map<string, number>();
	const kontraCountsMap = new Map<string, number>();
	const eyesTotals = new Map<string, number>();
	const eyesCounts = new Map<string, number>();
	const dokoCounts = new Map<string, number>();
	const fuchsCounts = new Map<string, number>();
	const karlchenCounts = new Map<string, number>();
	const gamesPlayed = new Map<string, number>();
	const gamesWonCount = new Map<string, number>();
	const roundsWonCount = new Map<string, number>();
	const perGameTotals = new Map<string, number[]>();
	const reRoundsPlayed = new Map<string, number>();
	const reRoundsWon = new Map<string, number>();
	const kontraRoundsPlayed = new Map<string, number>();
	const kontraRoundsWon = new Map<string, number>();
	const roundsPlayed = new Map<string, number>();

	const normalTotals = new Map<string, number>();
	const normalCounts = new Map<string, number>();
	const hochzeitTotals = new Map<string, number>();
	const hochzeitCounts = new Map<string, number>();
	const soloTotals = new Map<string, number>();
	const soloCounts = new Map<string, number>();

	const soloTypeCounts = new Map<RoundType, number>();
	soloTypeOrder.forEach((t) => soloTypeCounts.set(t, 0));

	// Track total rounds by type
	let totalNormalRounds = 0;
	let totalHochzeitRounds = 0;
	let totalSoloRounds = 0;

	const callTypes = [
		CallType.RE,
		CallType.KONTRA,
		CallType.Keine90,
		CallType.Keine60,
		CallType.Keine30,
		CallType.Schwarz
	];
	const callCountsMap: Record<string, Map<string, number>> = {};

	// Player pairs for avg points per pair
	const pairs: { a: { id: string; name: string }; b: { id: string; name: string } }[] = [];
	for (let i = 0; i < players.length; i++) {
		for (let j = i + 1; j < players.length; j++) {
			pairs.push({ a: players[i], b: players[j] });
		}
	}
	const pairTotals = new Map<string, number>();
	const pairCounts = new Map<string, number>();
	const pairTeamRoundCounts = new Map<string, number>();
	for (const pair of pairs) {
		const key = `${pair.a.name} & ${pair.b.name}`;
		pairTotals.set(key, 0);
		pairCounts.set(key, 0);
		pairTeamRoundCounts.set(key, 0);
	}

	// Group-level daily aggregates for timeline charts
	const dailyTotals = new Map<string, { games: number; rounds: number }>();

	for (const pl of players) {
		reCounts.set(pl.id, 0);
		kontraCounts.set(pl.id, 0);
		normalWins.set(pl.id, 0);
		normalTotal.set(pl.id, 0);
		hochzeitWins.set(pl.id, 0);
		hochzeitTotal.set(pl.id, 0);
		soloWins.set(pl.id, 0);
		soloTotal.set(pl.id, 0);
		reTotals.set(pl.id, 0);
		reCountsMap.set(pl.id, 0);
		kontraTotals.set(pl.id, 0);
		kontraCountsMap.set(pl.id, 0);
		eyesTotals.set(pl.id, 0);
		eyesCounts.set(pl.id, 0);
		dokoCounts.set(pl.id, 0);
		fuchsCounts.set(pl.id, 0);
		karlchenCounts.set(pl.id, 0);
		gamesPlayed.set(pl.id, 0);
		gamesWonCount.set(pl.id, 0);
		roundsWonCount.set(pl.id, 0);
		perGameTotals.set(pl.id, []);
		reRoundsPlayed.set(pl.id, 0);
		reRoundsWon.set(pl.id, 0);
		kontraRoundsPlayed.set(pl.id, 0);
		kontraRoundsWon.set(pl.id, 0);
		roundsPlayed.set(pl.id, 0);
		normalTotals.set(pl.id, 0);
		normalCounts.set(pl.id, 0);
		hochzeitTotals.set(pl.id, 0);
		hochzeitCounts.set(pl.id, 0);
		soloTotals.set(pl.id, 0);
		soloCounts.set(pl.id, 0);
		const m = new Map<string, number>();
		callTypes.forEach((ct) => m.set(ct, 0));
		callCountsMap[pl.id] = m;
	}

	for (const game of finishedGames) {
		// Count a game for each participant present
		const participantIds = new Set<string>();
		for (const p of game.participants || []) {
			if (!p.player) continue;
			participantIds.add(p.player.id);
		}
		for (const pid of participantIds) {
			increment(gamesPlayed, pid);
		}

		// Track daily totals (per group, not per player)
		const dateKey = game.createdAt ? new Date(game.createdAt).toISOString().slice(0, 10) : '';
		const roundCount = game.rounds?.length ?? 0;
		if (dateKey) {
			const existing = dailyTotals.get(dateKey) ?? { games: 0, rounds: 0 };
			dailyTotals.set(dateKey, {
				games: existing.games + 1,
				rounds: existing.rounds + roundCount
			});
		}

		// Aggregate per game totals
		const gameTotals = new Map<string, number>(); // per-player total points this game

		for (const round of game.rounds || []) {
			const roundPoints = round.calculatePoints();
			const eyesRe = round.eyesRe ?? 0;
			const rType = (round as any).type as RoundType;
			const category: 'normal' | 'hochzeit' | 'solo' =
				rType === RoundType.Normal
					? 'normal'
					: rType === RoundType.HochzeitNormal ||
						  rType === RoundType.HochzeitStill ||
						  rType === RoundType.HochzeitUngeklaert
						? 'hochzeit'
						: 'solo';

			// Count total rounds by type
			if (category === 'normal') totalNormalRounds++;
			else if (category === 'hochzeit') totalHochzeitRounds++;
			else {
				totalSoloRounds++;
				increment(soloTypeCounts, rType);
			}

			// Team map for this round
			const teamMap = new Map<string, string>();
			for (const participant of round.participants) {
				teamMap.set(participant.playerId, participant.team);

				// Team counts
				if (participant.team === Team.RE) {
					increment(reCounts, participant.playerId);
				} else if (participant.team === Team.KONTRA) {
					increment(kontraCounts, participant.playerId);
				}

				// Bonuses
				(participant.bonuses || []).forEach((b: any) => {
					if (b.bonusType === BonusType.Doko) {
						increment(dokoCounts, participant.playerId, b.count || 0);
					} else if (b.bonusType === BonusType.Fuchs) {
						increment(fuchsCounts, participant.playerId, b.count || 0);
					} else if (b.bonusType === BonusType.Karlchen) {
						increment(karlchenCounts, participant.playerId, b.count || 0);
					}
				});

				// Calls
				(participant.calls || []).forEach((c: any) => {
					const m = callCountsMap[participant.playerId];
					if (!m) return;
					increment(m, c.callType);
				});

				// Eyes
				const achievedEyes = participant.team === Team.RE ? eyesRe : 240 - eyesRe;
				increment(eyesTotals, participant.playerId, achievedEyes);
				increment(eyesCounts, participant.playerId);
				increment(roundsPlayed, participant.playerId);
			}

			// Track pair team rounds (for each pair, count rounds where both are on same team)
			for (const pair of pairs) {
				const teamA = teamMap.get(pair.a.id);
				const teamB = teamMap.get(pair.b.id);
				if (teamA && teamB && teamA === teamB) {
					const pairKey = `${pair.a.name} & ${pair.b.name}`;
					increment(pairTeamRoundCounts, pairKey);
				}
			}

			// Round points and per-team averages, win/loss
			for (const rp of roundPoints) {
				// per-game totals
				increment(gameTotals, rp.playerId, rp.points);

				// Track totals per game type
				if (category === 'normal') increment(normalTotal, rp.playerId);
				else if (category === 'hochzeit') increment(hochzeitTotal, rp.playerId);
				else increment(soloTotal, rp.playerId);

				if (rp.points > 0) {
					increment(roundsWonCount, rp.playerId);
					if (category === 'normal') increment(normalWins, rp.playerId);
					else if (category === 'hochzeit') increment(hochzeitWins, rp.playerId);
					else increment(soloWins, rp.playerId);
				}

				const team = teamMap.get(rp.playerId);
				if (team === Team.RE) {
					increment(reTotals, rp.playerId, rp.points);
					increment(reCountsMap, rp.playerId);
					increment(reRoundsPlayed, rp.playerId);
					if (rp.points > 0) increment(reRoundsWon, rp.playerId);
				} else if (team === Team.KONTRA) {
					increment(kontraTotals, rp.playerId, rp.points);
					increment(kontraCountsMap, rp.playerId);
					increment(kontraRoundsPlayed, rp.playerId);
					if (rp.points > 0) increment(kontraRoundsWon, rp.playerId);
				}

				// Per game type totals
				if (category === 'normal') {
					increment(normalTotals, rp.playerId, rp.points);
					increment(normalCounts, rp.playerId);
				} else if (category === 'hochzeit') {
					increment(hochzeitTotals, rp.playerId, rp.points);
					increment(hochzeitCounts, rp.playerId);
				} else {
					increment(soloTotals, rp.playerId, rp.points);
					increment(soloCounts, rp.playerId);
				}
			}
		}

		// Store per-game totals for per-player arrays
		for (const [pid, total] of gameTotals.entries()) {
			const arr = perGameTotals.get(pid) || [];
			arr.push(total);
			perGameTotals.set(pid, arr);
		}

		// Determine game winner (player with highest total in this game)
		let maxPoints = -Infinity;
		let winnerIds: string[] = [];
		for (const [pid, total] of gameTotals.entries()) {
			if (total > maxPoints) {
				maxPoints = total;
				winnerIds = [pid];
			} else if (total === maxPoints) {
				winnerIds.push(pid);
			}
		}
		// Award full win to all tied winners
		for (const wid of winnerIds) {
			increment(gamesWonCount, wid);
		}

		// Track pair totals for this game
		for (const pair of pairs) {
			const aTotal = gameTotals.get(pair.a.id) || 0;
			const bTotal = gameTotals.get(pair.b.id) || 0;
			const pairKey = `${pair.a.name} & ${pair.b.name}`;
			if (aTotal !== 0 && bTotal !== 0) {
				increment(pairTotals, pairKey, aTotal + bTotal);
				increment(pairCounts, pairKey);
			}
		}
	}

	const series = players.map((pl) => ({
		key: pl.name,
		label: pl.name,
		color: playerColorMap.get(pl.id)
	}));

	const reKontraShare = players.map((pl) => {
		const re = reCounts.get(pl.id) || 0;
		const kontra = kontraCounts.get(pl.id) || 0;
		const total = re + kontra;
		return {
			player: pl.name,
			reShare: total ? re / total : 0,
			kontraShare: total ? kontra / total : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	const avgPairs = Array.from(pairCounts.entries())
		.map(([key, count]) => ({
			key,
			value: count > 0 ? (pairTotals.get(key) || 0) / count : 0,
			color: 'var(--color-teal-400)'
		}))
		.sort((a, b) => b.value - a.value);

	const pairTeamCounts = Array.from(pairTeamRoundCounts.entries())
		.map(([key, count]) => ({ key, value: count, color: 'var(--color-amber-500)' }))
		.sort((a, b) => b.value - a.value);

	const winLostShareByType = players.map((pl) => {
		const nW = normalWins.get(pl.id) || 0;
		const nT = normalTotal.get(pl.id) || 0;
		const hW = hochzeitWins.get(pl.id) || 0;
		const hT = hochzeitTotal.get(pl.id) || 0;
		const sW = soloWins.get(pl.id) || 0;
		const sT = soloTotal.get(pl.id) || 0;

		return {
			player: pl.name,
			normalWinShare: nT ? nW / nT : 0,
			hochzeitWinShare: hT ? hW / hT : 0,
			soloWinShare: sT ? sW / sT : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	const avgReKontra = players.map((pl) => ({
		key: pl.name,
		reAvg: reCountsMap.get(pl.id) ? reTotals.get(pl.id)! / (reCountsMap.get(pl.id) || 1) : 0,
		kontraAvg: kontraCountsMap.get(pl.id)
			? kontraTotals.get(pl.id)! / (kontraCountsMap.get(pl.id) || 1)
			: 0,
		color: playerColorMap.get(pl.id)
	}));

	const bonusGrouped = players.map((pl) => ({
		player: pl.name,
		doko: dokoCounts.get(pl.id) || 0,
		fuchs: fuchsCounts.get(pl.id) || 0,
		karlchen: karlchenCounts.get(pl.id) || 0,
		color: playerColorMap.get(pl.id)
	}));

	const avgEyes = players.map((pl) => ({
		player: pl.name,
		avgEyes: eyesCounts.get(pl.id) ? eyesTotals.get(pl.id)! / (eyesCounts.get(pl.id) || 1) : 0,
		color: playerColorMap.get(pl.id)
	}));

	const avgEyesGrouped = players.map((pl) => {
		const found = avgEyes.find((a) => a.player === pl.name);
		return {
			player: pl.name,
			[pl.name]: found ? found.avgEyes : 0,
			color: playerColorMap.get(pl.id)
		} as Record<string, any>;
	});

	const callGrouped = players.map((pl) => ({
		player: pl.name,
		RE: callCountsMap[pl.id]?.get(CallType.RE) || 0,
		KONTRA: callCountsMap[pl.id]?.get(CallType.KONTRA) || 0,
		Keine90: callCountsMap[pl.id]?.get(CallType.Keine90) || 0,
		Keine60: callCountsMap[pl.id]?.get(CallType.Keine60) || 0,
		Keine30: callCountsMap[pl.id]?.get(CallType.Keine30) || 0,
		Schwarz: callCountsMap[pl.id]?.get(CallType.Schwarz) || 0,
		color: playerColorMap.get(pl.id)
	}));

	const gamesPlayedArr = players.map((pl) => {
		const games = gamesPlayed.get(pl.id) || 0;
		return {
			player: pl.name,
			games,
			[pl.name]: games,
			color: playerColorMap.get(pl.id)
		} as Record<string, any>;
	});

	const totalGamesWon = Array.from(gamesWonCount.values()).reduce((a, b) => a + b, 0);
	const gamesWon = players.map((pl) => {
		const wins = gamesWonCount.get(pl.id) || 0;
		const percent = totalGamesWon ? wins / totalGamesWon : 0;
		return {
			player: pl.name,
			value: wins,
			percent,
			color: playerColorMap.get(pl.id)
		};
	});

	const roundsPlayedArr = players.map((pl) => {
		const rounds = roundsPlayed.get(pl.id) || 0;
		return {
			player: pl.name,
			rounds,
			[pl.name]: rounds,
			color: playerColorMap.get(pl.id)
		} as Record<string, any>;
	});

	const totalRoundsWon = Array.from(roundsWonCount.values()).reduce((a, b) => a + b, 0);
	const roundsWon = players.map((pl) => {
		const wins = roundsWonCount.get(pl.id) || 0;
		const percent = totalRoundsWon ? wins / totalRoundsWon : 0;
		return {
			player: pl.name,
			value: wins,
			percent,
			color: playerColorMap.get(pl.id)
		};
	});

	const avgTotalPointsPerGame = players.map((pl) => {
		const arr = perGameTotals.get(pl.id) || [];
		const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
		return {
			player: pl.name,
			value: avg,
			[pl.name]: avg,
			color: playerColorMap.get(pl.id)
		} as Record<string, any>;
	});

	const consistency = players.map((pl) => {
		const arr = perGameTotals.get(pl.id) || [];
		if (arr.length === 0) return { player: pl.name, stdev: 0, color: playerColorMap.get(pl.id) };
		const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
		const variance = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / arr.length;
		const stdev = Math.sqrt(variance);
		return { player: pl.name, stdev, color: playerColorMap.get(pl.id) };
	});

	const teamWinRates = players.map((pl) => {
		const reP = reRoundsPlayed.get(pl.id) || 0;
		const reW = reRoundsWon.get(pl.id) || 0;
		const kontraP = kontraRoundsPlayed.get(pl.id) || 0;
		const kontraW = kontraRoundsWon.get(pl.id) || 0;
		return {
			player: pl.name,
			reRate: reP ? reW / reP : 0,
			kontraRate: kontraP ? kontraW / kontraP : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	const avgPointsByGameType = players.map((pl) => {
		const nC = normalCounts.get(pl.id) || 0;
		const hC = hochzeitCounts.get(pl.id) || 0;
		const sC = soloCounts.get(pl.id) || 0;
		return {
			player: pl.name,
			normal: nC ? normalTotals.get(pl.id)! / nC : 0,
			hochzeit: hC ? hochzeitTotals.get(pl.id)! / hC : 0,
			solo: sC ? soloTotals.get(pl.id)! / sC : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	const totalRounds = totalNormalRounds + totalHochzeitRounds + totalSoloRounds;
	const roundsByType = [
		{ type: 'Normal', value: totalNormalRounds, color: roundTypeColorPalette[0] },
		{ type: 'Hochzeit', value: totalHochzeitRounds, color: roundTypeColorPalette[1] },
		{ type: 'Solo', value: totalSoloRounds, color: roundTypeColorPalette[2] }
	].map((item) => {
		const percent = totalRounds ? item.value / totalRounds : 0;
		return {
			...item,
			percent
		};
	});

	const totalSoloTypeRounds = Array.from(soloTypeCounts.values()).reduce((a, b) => a + b, 0);
	const soloRoundsByType = soloTypeOrder.map((type) => {
		const value = soloTypeCounts.get(type) || 0;
		const percent = totalSoloTypeRounds ? value / totalSoloTypeRounds : 0;
		return {
			type: soloTypeLabels[type],
			value,
			percent,
			color: soloTypeColors[type]
		};
	});

	// Build cumulative timelines over time (per group)
	const gamesTimeline: Array<{ date: string; games: number }> = [];
	const roundsTimeline: Array<{ date: string; rounds: number }> = [];
	let cumulativeGames = 0;
	let cumulativeRounds = 0;

	const sortedDaily = Array.from(dailyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
	for (const [date, totals] of sortedDaily) {
		cumulativeGames += totals.games;
		cumulativeRounds += totals.rounds;
		gamesTimeline.push({ date, games: cumulativeGames });
		roundsTimeline.push({ date, rounds: cumulativeRounds });
	}

	return {
		playerSeries: { rows: [], series },
		reKontraShare,
		winLostShareByType,
		avgReKontra,
		avgPairs,
		bonusGrouped,
		avgEyesGrouped,
		avgEyes,
		callGrouped,
		pairTeamCounts,
		gamesPlayed: gamesPlayedArr,
		gamesWon,
		roundsPlayed: roundsPlayedArr,
		roundsWon,
		roundsTimeline,
		avgTotalPointsPerGame,
		gamesTimeline,
		consistency,
		teamWinRates,
		avgPointsByGameType,
		roundsByType,
		soloRoundsByType
	};
}

const emptyGroupStatistics = (): GroupStatistics => ({
	playerSeries: { rows: [], series: [] },
	reKontraShare: [],
	winLostShareByType: [],
	avgReKontra: [],
	avgPairs: [],
	pairTeamCounts: [],
	bonusGrouped: [],
	avgEyesGrouped: [],
	avgEyes: [],
	callGrouped: [],
	gamesPlayed: [],
	gamesWon: [],
	roundsPlayed: [],
	roundsWon: [],
	roundsTimeline: [],
	avgTotalPointsPerGame: [],
	gamesTimeline: [],
	consistency: [],
	teamWinRates: [],
	avgPointsByGameType: [],
	roundsByType: [],
	soloRoundsByType: []
});

export async function getGroupStatistics(args: {
	principalId: string;
	groupId: string;
	gameRepo?: GameRepository;
}): Promise<GroupStatistics> {
	const { principalId, groupId } = args;
	const gameRepo = args.gameRepo ?? new GameRepository(principalId);

	const listRes = await gameRepo.listByGroup(groupId);
	if (!listRes.ok) {
		throw error(listRes.status, listRes.error);
	}
	const gamesList = listRes.value || [];

	if (gamesList.length === 0) {
		return emptyGroupStatistics();
	}

	// Load full games with rounds in parallel to reduce waiting time
	const detailResults = await Promise.all(gamesList.map((g) => gameRepo.getById(g.id, groupId)));
	const okResults = detailResults.filter(
		(r): r is { ok: true; value: Game } => (r as any).ok === true
	) as Array<{
		ok: true;
		value: Game;
	}>;
	const fullGames: Game[] = okResults
		.map((r) => r.value)
		.filter((game) => Array.isArray(game.rounds) && game.rounds.length > 0);

	if (fullGames.length === 0) {
		return emptyGroupStatistics();
	}

	return calculateGroupStatistics(fullGames);
}
