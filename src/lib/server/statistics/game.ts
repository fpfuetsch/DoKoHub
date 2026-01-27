import { error } from '@sveltejs/kit';
import { Team, BonusType, CallType, RoundType } from '$lib/domain/enums';
import type { Game } from '$lib/domain/game';
import { generateDistinctColorPalette } from '$lib/utils/colors';
import {
	bonusSeries,
	callSeries,
	increment,
	reKontraSeries,
	reKontraRateSeries,
	reKontraAvgSeries,
	roundTypeColorPalette,
	soloTypeColors,
	soloTypeLabels,
	soloTypeOrder
} from './shared';

/**
 * Comprehensive statistics output for a single game.
 * Contains all aggregated and calculated metrics.
 */
export interface GameStatistics {
	playerSeries: {
		rows: Record<string, number | null>[];
		series: Array<{ key: string; label: string; color?: string }>;
	};
	reKontraShare: Array<{
		player: string;
		reShare: number;
		kontraShare: number;
		color?: string;
	}>;
	winLostShareByType: Array<{
		player: string;
		normalWinShare: number;
		soloWinShare: number;
		color?: string;
	}>;
	avgReKontra: Array<{
		key: string;
		reAvg: number;
		kontraAvg: number;
		color?: string;
	}>;
	avgPairs: Array<{
		key: string;
		value: number;
		color?: string;
	}>;
	pairTeamCounts: Array<{
		key: string;
		value: number;
		color?: string;
	}>;
	bonusGrouped: Array<{
		player: string;
		doko: number;
		fuchs: number;
		karlchen: number;
		color?: string;
	}>;
	avgEyesGrouped: Array<Record<string, any>>;
	avgEyes: Array<{
		player: string;
		avgEyes: number;
		color?: string;
	}>;
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
	callSuccessRate: Array<{
		player: string;
		RE: number;
		KONTRA: number;
		Keine90: number;
		Keine60: number;
		Keine30: number;
		Schwarz: number;
		color?: string;
	}>;
	roundsWon: Array<{ player: string; value: number; percent: number; color?: string }>;
	roundsByType: Array<{ type: string; value: number; percent: number }>;
	soloRoundsByType: Array<{ type: string; value: number; percent: number; color?: string }>;
	soloTypeShareByPlayer: Array<Record<string, any>>;
	soloTypeWinRateByPlayer: Array<Record<string, any>>;
	avgPointsByGameType: Array<{
		player: string;
		normal: number;
		solo: number;
		color?: string;
	}>;
	avgPointsBySoloType: Array<Record<string, any>>;
	teamWinRates: Array<{ player: string; reRate: number; kontraRate: number; color?: string }>;
	soloTypeSeries: Array<{ key: string; label: string; color?: string }>;
	roundTypeSeries: Array<{ key: string; label: string; color?: string }>;
	callSeries: Array<{ key: string; label: string; color?: string }>;
	bonusSeries: Array<{ key: string; label: string; color?: string }>;
	reKontraSeries: Array<{ key: string; label: string; color?: string }>;
	reKontraRateSeries: Array<{ key: string; label: string; color?: string }>;
	reKontraAvgSeries: Array<{ key: string; label: string; color?: string }>;
}

/**
 * Aggregated data from a single pass over game rounds.
 * Contains all raw counts, totals, and cumulative data needed for statistics.
 * All calculations use this aggregated data without additional passes.
 */
export interface GameAggregates {
	// Player info
	playerList: Array<{ id: string; name: string }>;
	playerColorMap: Map<string, string>;

	// Per-player: basic round participation
	reCounts: Map<string, number>; // Total RE participations
	kontraCounts: Map<string, number>; // Total KONTRA participations

	// Per-player: points by team
	reTotals: Map<string, number>; // Total points when playing RE
	kontraTotals: Map<string, number>; // Total points when playing KONTRA
	reCountsMap: Map<string, number>; // Count of RE rounds for averaging
	kontraCountsMap: Map<string, number>; // Count of KONTRA rounds for averaging

	// Per-player: eyes
	eyesTotals: Map<string, number>;
	eyesCounts: Map<string, number>;

	// Per-player: bonuses
	dokoCounts: Map<string, number>;
	fuchsCounts: Map<string, number>;
	karlchenCounts: Map<string, number>;

	// Per-player: wins
	roundsWonCount: Map<string, number>;
	reRoundsPlayed: Map<string, number>;
	reRoundsWon: Map<string, number>;
	kontraRoundsPlayed: Map<string, number>;
	kontraRoundsWon: Map<string, number>;

	// Per-player: round type participation (all rounds)
	normalTotal: Map<string, number>;
	soloTotal: Map<string, number>;

	// Per-player: round type wins
	normalWins: Map<string, number>;
	soloWins: Map<string, number>;

	// Per-player: round type points
	normalTotals: Map<string, number>;
	normalCounts: Map<string, number>;
	soloTotals: Map<string, number>;
	soloCounts: Map<string, number>;

	// Per-player: solo-type participation (only for RE player in solos)
	playerSoloTypeCounts: Map<string, Map<RoundType, number>>;
	playerSoloTypeWins: Map<string, Map<RoundType, number>>;
	playerSoloTypePoints: Map<string, Map<RoundType, number>>;

	// Round-level: solo type counts
	soloTypeCounts: Map<RoundType, number>;

	// Per-player: calls (all calls, regardless of win)
	callCountsMap: Record<string, Map<string, number>>;

	// Per-player: calls that were wins
	callWinsMap: Record<string, Map<string, number>>;

	// Pair-level: averages
	pairs: Array<{ a: { id: string; name: string }; b: { id: string; name: string } }>;
	pairTotals: Map<string, number>;
	pairCounts: Map<string, number>;
	pairTeamRoundCounts: Map<string, number>;

	// Cumulative points per player per round
	playerPointsMap: Map<string, Array<{ round: number; cumulativePoints: number }>>;

	// Round totals
	totalNormalRounds: number;
	totalSoloRounds: number;

	// Unique round numbers
	rounds: number[];
}

/**
 * Single-pass aggregation over game rounds.
 * Collects all raw data into GameAggregates.
 * O(rounds × participants) time complexity.
 *
 * Handles both round-type and solo-type filtering in one pass:
 * - Round-type stats (normal, solo) include ALL participant rounds
 * - Solo-type stats only track RE player's solos
 */
export function aggregateGameRounds(game: Game): GameAggregates {
	const rounds = Array.from(new Set(game.rounds.map((r) => r.roundNumber))).sort((a, b) => a - b);
	const playerList = game.participants
		.filter((p) => p.player)
		.map((p) => ({
			id: p.player!.id,
			name: p.player!.getTruncatedDisplayName() || 'Unknown'
		}));

	const palette = generateDistinctColorPalette(playerList.length);
	const playerColorMap = new Map<string, string>();
	playerList.forEach((pl, idx) => playerColorMap.set(pl.id, palette[idx % palette.length]));

	// Initialize all aggregates
	const playerPointsMap = new Map<string, Array<{ round: number; cumulativePoints: number }>>();
	const reCounts = new Map<string, number>();
	const kontraCounts = new Map<string, number>();
	const reTotals = new Map<string, number>();
	const reCountsMap = new Map<string, number>();
	const kontraTotals = new Map<string, number>();
	const kontraCountsMap = new Map<string, number>();
	const eyesTotals = new Map<string, number>();
	const eyesCounts = new Map<string, number>();
	const dokoCounts = new Map<string, number>();
	const fuchsCounts = new Map<string, number>();
	const karlchenCounts = new Map<string, number>();
	const roundsWonCount = new Map<string, number>();
	const reRoundsPlayed = new Map<string, number>();
	const reRoundsWon = new Map<string, number>();
	const kontraRoundsPlayed = new Map<string, number>();
	const kontraRoundsWon = new Map<string, number>();

	const normalWins = new Map<string, number>();
	const normalTotal = new Map<string, number>();
	const soloWins = new Map<string, number>();
	const soloTotal = new Map<string, number>();
	const normalTotals = new Map<string, number>();
	const normalCounts = new Map<string, number>();
	const soloTotals = new Map<string, number>();
	const soloCounts = new Map<string, number>();

	const soloTypeCounts = new Map<RoundType, number>();
	const playerSoloTypeCounts = new Map<string, Map<RoundType, number>>();
	const playerSoloTypeWins = new Map<string, Map<RoundType, number>>();
	const playerSoloTypePoints = new Map<string, Map<RoundType, number>>();
	soloTypeOrder.forEach((t) => soloTypeCounts.set(t, 0));

	const callTypes = [
		CallType.RE,
		CallType.KONTRA,
		CallType.Keine90,
		CallType.Keine60,
		CallType.Keine30,
		CallType.Schwarz
	];
	const callCountsMap: Record<string, Map<string, number>> = {};
	const callWinsMap: Record<string, Map<string, number>> = {};

	playerList.forEach((pl) => {
		playerPointsMap.set(pl.id, []);
		reCounts.set(pl.id, 0);
		kontraCounts.set(pl.id, 0);
		reTotals.set(pl.id, 0);
		reCountsMap.set(pl.id, 0);
		kontraTotals.set(pl.id, 0);
		kontraCountsMap.set(pl.id, 0);
		eyesTotals.set(pl.id, 0);
		eyesCounts.set(pl.id, 0);
		dokoCounts.set(pl.id, 0);
		fuchsCounts.set(pl.id, 0);
		karlchenCounts.set(pl.id, 0);
		roundsWonCount.set(pl.id, 0);
		reRoundsPlayed.set(pl.id, 0);
		reRoundsWon.set(pl.id, 0);
		kontraRoundsPlayed.set(pl.id, 0);
		kontraRoundsWon.set(pl.id, 0);
		normalWins.set(pl.id, 0);
		normalTotal.set(pl.id, 0);
		soloWins.set(pl.id, 0);
		soloTotal.set(pl.id, 0);
		normalTotals.set(pl.id, 0);
		normalCounts.set(pl.id, 0);
		soloTotals.set(pl.id, 0);
		soloCounts.set(pl.id, 0);

		const soloTypeCountMap = new Map<RoundType, number>();
		const soloTypeWinMap = new Map<RoundType, number>();
		const soloTypePointMap = new Map<RoundType, number>();
		soloTypeOrder.forEach((t) => {
			soloTypeCountMap.set(t, 0);
			soloTypeWinMap.set(t, 0);
			soloTypePointMap.set(t, 0);
		});
		playerSoloTypeCounts.set(pl.id, soloTypeCountMap);
		playerSoloTypeWins.set(pl.id, soloTypeWinMap);
		playerSoloTypePoints.set(pl.id, soloTypePointMap);

		const m = new Map<string, number>();
		const wm = new Map<string, number>();
		callTypes.forEach((ct) => {
			m.set(ct, 0);
			wm.set(ct, 0);
		});
		callCountsMap[pl.id] = m;
		callWinsMap[pl.id] = wm;
	});

	// Prepare pair data
	const pairs: Array<{ a: { id: string; name: string }; b: { id: string; name: string } }> = [];
	for (let i = 0; i < playerList.length; i++) {
		for (let j = i + 1; j < playerList.length; j++) {
			pairs.push({ a: playerList[i], b: playerList[j] });
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

	let totalNormalRounds = 0;
	let totalSoloRounds = 0;

	// SINGLE PASS over all rounds
	for (const round of game.rounds) {
		const roundPoints = round.calculatePoints();
		const eyesRe = round.eyesRe ?? 0;
		const rType = (round as any).type as RoundType;
		const isSolo =
			typeof (round as any).isSolo === 'function'
				? (round as any).isSolo()
				: rType !== RoundType.Normal && rType !== RoundType.HochzeitNormal;
		const category: 'normal' | 'solo' = isSolo ? 'solo' : 'normal';

		// Count total rounds by type
		if (category === 'normal') totalNormalRounds++;
		else {
			totalSoloRounds++;
			increment(soloTypeCounts, rType);
		}

		// Create team map for this round
		const teamMap = new Map<string, string>();
		for (const participant of round.participants) {
			teamMap.set(participant.playerId, participant.team);

			// Track per-player round type participation
			if (category === 'normal') {
				increment(normalTotal, participant.playerId);
			} else {
				// Count all solo participants for round-type stats
				increment(soloTotal, participant.playerId);
				// Only track solo-type stats for RE player
				if (participant.team === Team.RE) {
					const soloTypeMap = playerSoloTypeCounts.get(participant.playerId);
					if (soloTypeMap) increment(soloTypeMap, rType);
				}
			}

			// RE/KONTRA participation counts
			if (participant.team === Team.RE) {
				increment(reCounts, participant.playerId);
				increment(reRoundsPlayed, participant.playerId);
			} else if (participant.team === Team.KONTRA) {
				increment(kontraCounts, participant.playerId);
				increment(kontraRoundsPlayed, participant.playerId);
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

			// Eyes (team achieved)
			const achievedEyes = participant.team === Team.RE ? eyesRe : 240 - eyesRe;
			increment(eyesTotals, participant.playerId, achievedEyes);
			increment(eyesCounts, participant.playerId);
		}

		// Track pair team rounds
		for (const pair of pairs) {
			const teamA = teamMap.get(pair.a.id);
			const teamB = teamMap.get(pair.b.id);
			if (teamA && teamB && teamA === teamB) {
				const pairKey = `${pair.a.name} & ${pair.b.name}`;
				increment(pairTeamRoundCounts, pairKey);
			}
		}

		// Update cumulative points and round outcome stats
		for (const rp of roundPoints) {
			const playerHistory = playerPointsMap.get(rp.playerId) || [];
			const lastCumulative =
				playerHistory.length > 0 ? playerHistory[playerHistory.length - 1].cumulativePoints : 0;
			playerHistory.push({
				round: round.roundNumber,
				cumulativePoints: lastCumulative + rp.points
			});
			playerPointsMap.set(rp.playerId, playerHistory);

			// Win counts and call success
			if (rp.points > 0) {
				increment(roundsWonCount, rp.playerId);

				// Track call success for this player
				const roundParticipant = round.participants.find((p) => p.playerId === rp.playerId);
				if (roundParticipant) {
					(roundParticipant.calls || []).forEach((c: any) => {
						const wm = callWinsMap[rp.playerId];
						if (wm) increment(wm, c.callType);
					});
				}

				// Track wins by round type
				if (category === 'normal') {
					increment(normalWins, rp.playerId);
				} else {
					// Count all solo wins (round-type stats)
					increment(soloWins, rp.playerId);
					// Only track solo-type wins for RE player
					const team = teamMap.get(rp.playerId);
					if (team === Team.RE) {
						const soloTypeWinMap = playerSoloTypeWins.get(rp.playerId);
						if (soloTypeWinMap) increment(soloTypeWinMap, rType);
					}
				}

				// Track team win rates
				const teamForWinRate = teamMap.get(rp.playerId);
				if (teamForWinRate === Team.RE) {
					increment(reRoundsWon, rp.playerId);
				} else if (teamForWinRate === Team.KONTRA) {
					increment(kontraRoundsWon, rp.playerId);
				}
			}

			// Track points by round type (for averages)
			if (category === 'normal') {
				increment(normalTotals, rp.playerId, rp.points);
				increment(normalCounts, rp.playerId);
			} else {
				increment(soloTotals, rp.playerId, rp.points);
				increment(soloCounts, rp.playerId);
				// Only track solo-type points for RE player
				const team = teamMap.get(rp.playerId);
				if (team === Team.RE) {
					const soloTypePointMap = playerSoloTypePoints.get(rp.playerId);
					if (soloTypePointMap) increment(soloTypePointMap, rType, rp.points);
				}
			}

			// Track RE/KONTRA point averages
			const team = teamMap.get(rp.playerId);
			if (team === Team.RE) {
				increment(reTotals, rp.playerId, rp.points);
				increment(reCountsMap, rp.playerId);
			} else if (team === Team.KONTRA) {
				increment(kontraTotals, rp.playerId, rp.points);
				increment(kontraCountsMap, rp.playerId);
			}
		}

		// Pair point totals
		const rpMap = new Map(roundPoints.map((rp) => [rp.playerId, rp.points] as const));
		for (const pair of pairs) {
			const key = `${pair.a.name} & ${pair.b.name}`;
			const aPoints = rpMap.get(pair.a.id) ?? 0;
			const bPoints = rpMap.get(pair.b.id) ?? 0;
			pairTotals.set(key, (pairTotals.get(key) || 0) + aPoints + bPoints);
			pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
		}
	}

	return {
		playerList,
		playerColorMap,
		reCounts,
		kontraCounts,
		reTotals,
		kontraTotals,
		reCountsMap,
		kontraCountsMap,
		eyesTotals,
		eyesCounts,
		dokoCounts,
		fuchsCounts,
		karlchenCounts,
		roundsWonCount,
		reRoundsPlayed,
		reRoundsWon,
		kontraRoundsPlayed,
		kontraRoundsWon,
		normalWins,
		normalTotal,
		soloWins,
		soloTotal,
		normalTotals,
		normalCounts,
		soloTotals,
		soloCounts,
		playerSoloTypeCounts,
		playerSoloTypeWins,
		playerSoloTypePoints,
		soloTypeCounts,
		callCountsMap,
		callWinsMap,
		pairs,
		pairTotals,
		pairCounts,
		pairTeamRoundCounts,
		playerPointsMap,
		totalNormalRounds,
		totalSoloRounds,
		rounds
	};
}

// ============================================================================
// CALCULATION FUNCTIONS
// Each function takes GameAggregates and returns formatted output.
// No additional passes over data.
// ============================================================================

/**
 * Calculate cumulative points series for line chart
 */
export function calculatePlayerSeries(agg: GameAggregates) {
	const lastCumulativePerPlayer = new Map<string, number>();
	const rows = agg.rounds.map((roundNum) => {
		const row: Record<string, number | null> = { round: roundNum };
		for (const [playerId, history] of agg.playerPointsMap.entries()) {
			const playerEntry = agg.playerList.find((p) => p.id === playerId);
			const playerName = playerEntry?.name || playerId;
			const pointEntry = history.find((h) => h.round === roundNum);

			if (pointEntry) {
				row[playerName] = pointEntry.cumulativePoints;
				lastCumulativePerPlayer.set(playerId, pointEntry.cumulativePoints);
			} else {
				const lastPoints = lastCumulativePerPlayer.get(playerId);
				row[playerName] = lastPoints !== undefined ? lastPoints : 0;
			}
		}
		return row;
	});

	const series = agg.playerList.map((pl) => ({
		key: pl.name,
		label: pl.name,
		color: agg.playerColorMap.get(pl.id)
	}));

	return { rows, series };
}

/**
 * Calculate RE vs KONTRA participation share
 */
export function calculateReKontraShare(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const re = agg.reCounts.get(pl.id) || 0;
		const kontra = agg.kontraCounts.get(pl.id) || 0;
		const total = re + kontra;
		return {
			player: pl.name,
			reShare: total ? re / total : 0,
			kontraShare: total ? kontra / total : 0,
			color: agg.playerColorMap.get(pl.id)
		};
	});
}

/**
 * Calculate average points when playing RE vs KONTRA
 */
export function calculateAvgReKontra(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		key: pl.name,
		reAvg: agg.reCountsMap.get(pl.id)
			? agg.reTotals.get(pl.id)! / (agg.reCountsMap.get(pl.id) || 1)
			: 0,
		kontraAvg: agg.kontraCountsMap.get(pl.id)
			? agg.kontraTotals.get(pl.id)! / (agg.kontraCountsMap.get(pl.id) || 1)
			: 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate average points per player pair partnership
 */
export function calculateAvgPairs(agg: GameAggregates) {
	return Array.from(agg.pairTotals.entries())
		.map(([key, total]) => ({
			key,
			value: total / (agg.pairCounts.get(key) || 1),
			color: (() => {
				const firstName = key.split(' & ')[0];
				const pl = agg.playerList.find((p) => p.name === firstName);
				return pl ? agg.playerColorMap.get(pl.id) : generateDistinctColorPalette(1)[0];
			})()
		}))
		.sort((a, b) => b.value - a.value);
}

/**
 * Calculate bonuses per player (Doppelkopf, Fuchs, Karlchen)
 */
export function calculateBonusGrouped(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		player: pl.name,
		doko: agg.dokoCounts.get(pl.id) || 0,
		fuchs: agg.fuchsCounts.get(pl.id) || 0,
		karlchen: agg.karlchenCounts.get(pl.id) || 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate average eyes per player
 */
export function calculateAvgEyes(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		player: pl.name,
		avgEyes: agg.eyesCounts.get(pl.id)
			? agg.eyesTotals.get(pl.id)! / (agg.eyesCounts.get(pl.id) || 1)
			: 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate average eyes grouped by player name
 */
export function calculateAvgEyesGrouped(agg: GameAggregates) {
	const avgEyes = calculateAvgEyes(agg);
	return agg.playerList.map((pl) => {
		const found = avgEyes.find((a) => a.player === pl.name);
		return {
			player: pl.name,
			[pl.name]: found ? found.avgEyes : 0,
			color: agg.playerColorMap.get(pl.id)
		} as Record<string, any>;
	});
}

/**
 * Calculate calls made per player by type
 */
export function calculateCallGrouped(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		player: pl.name,
		RE: agg.callCountsMap[pl.id].get(CallType.RE) || 0,
		KONTRA: agg.callCountsMap[pl.id].get(CallType.KONTRA) || 0,
		Keine90: agg.callCountsMap[pl.id].get(CallType.Keine90) || 0,
		Keine60: agg.callCountsMap[pl.id].get(CallType.Keine60) || 0,
		Keine30: agg.callCountsMap[pl.id].get(CallType.Keine30) || 0,
		Schwarz: agg.callCountsMap[pl.id].get(CallType.Schwarz) || 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate success rate per call type per player
 */
export function calculateCallSuccessRate(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const calcRate = (callType: CallType) => {
			const count = agg.callCountsMap[pl.id].get(callType) || 0;
			const wins = agg.callWinsMap[pl.id].get(callType) || 0;
			return count > 0 ? wins / count : 0;
		};
		return {
			player: pl.name,
			RE: calcRate(CallType.RE),
			KONTRA: calcRate(CallType.KONTRA),
			Keine90: calcRate(CallType.Keine90),
			Keine60: calcRate(CallType.Keine60),
			Keine30: calcRate(CallType.Keine30),
			Schwarz: calcRate(CallType.Schwarz),
			color: agg.playerColorMap.get(pl.id)
		};
	});
}

/**
 * Calculate rounds won per player with percentage
 */
export function calculateRoundsWon(agg: GameAggregates) {
	const totalRoundsWon = Array.from(agg.roundsWonCount.values()).reduce((a, b) => a + b, 0);
	return agg.playerList.map((pl) => {
		const value = agg.roundsWonCount.get(pl.id) || 0;
		return {
			player: pl.name,
			value,
			percent: totalRoundsWon > 0 ? value / totalRoundsWon : 0,
			color: agg.playerColorMap.get(pl.id)
		};
	});
}

/**
 * Calculate distribution of normal vs solo rounds
 */
export function calculateRoundsByType(agg: GameAggregates) {
	const totalRounds = agg.totalNormalRounds + agg.totalSoloRounds;
	return [
		{
			type: 'Normal',
			value: agg.totalNormalRounds,
			percent: totalRounds > 0 ? agg.totalNormalRounds / totalRounds : 0,
			color: roundTypeColorPalette[0]
		},
		{
			type: 'Solo',
			value: agg.totalSoloRounds,
			percent: totalRounds > 0 ? agg.totalSoloRounds / totalRounds : 0,
			color: roundTypeColorPalette[1]
		}
	];
}

/**
 * Calculate distribution of solo types
 */
export function calculateSoloRoundsByType(agg: GameAggregates) {
	return soloTypeOrder
		.map((rType) => {
			const value = agg.soloTypeCounts.get(rType) || 0;
			return {
				type: soloTypeLabels[rType] || rType,
				value,
				percent: agg.totalSoloRounds > 0 ? value / agg.totalSoloRounds : 0,
				color: soloTypeColors[rType]
			};
		})
		.filter((item) => item.value > 0);
}

/**
 * Calculate win/loss share by round type (normal vs solo)
 */
export function calculateWinLostShareByType(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const normalTotalRounds = agg.normalTotal.get(pl.id) || 0;
		const soloTotalRounds = agg.soloTotal.get(pl.id) || 0;
		return {
			player: pl.name,
			normalWinShare:
				normalTotalRounds > 0 ? (agg.normalWins.get(pl.id) || 0) / normalTotalRounds : 0,
			soloWinShare: soloTotalRounds > 0 ? (agg.soloWins.get(pl.id) || 0) / soloTotalRounds : 0,
			color: agg.playerColorMap.get(pl.id)
		};
	});
}

/**
 * Calculate average points in normal vs solo rounds
 */
export function calculateAvgPointsByGameType(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		player: pl.name,
		normal: agg.normalCounts.get(pl.id)
			? (agg.normalTotals.get(pl.id) || 0) / agg.normalCounts.get(pl.id)!
			: 0,
		solo: agg.soloCounts.get(pl.id)
			? (agg.soloTotals.get(pl.id) || 0) / agg.soloCounts.get(pl.id)!
			: 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate solo type distribution per player (only for RE/solos)
 */
export function calculateSoloTypeShareByPlayer(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const soloTypeMap = agg.playerSoloTypeCounts.get(pl.id);
		if (!soloTypeMap) return { player: pl.name, color: agg.playerColorMap.get(pl.id) };
		const totalSolos = Array.from(soloTypeMap.values()).reduce((a, b) => a + b, 0);
		const result: Record<string, any> = { player: pl.name, color: agg.playerColorMap.get(pl.id) };
		soloTypeOrder.forEach((rType) => {
			const count = soloTypeMap.get(rType) || 0;
			const label = soloTypeLabels[rType] || '';
			result[label] = totalSolos ? count / totalSolos : 0;
		});
		return result;
	});
}

/**
 * Calculate win rates per solo type per player (only for RE/solos)
 */
export function calculateSoloTypeWinRateByPlayer(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const soloTypeCountMap = agg.playerSoloTypeCounts.get(pl.id);
		const soloTypeWinMap = agg.playerSoloTypeWins.get(pl.id);
		if (!soloTypeCountMap || !soloTypeWinMap)
			return { player: pl.name, color: agg.playerColorMap.get(pl.id) };
		const result: Record<string, any> = { player: pl.name, color: agg.playerColorMap.get(pl.id) };
		soloTypeOrder.forEach((rType) => {
			const count = soloTypeCountMap.get(rType) || 0;
			const wins = soloTypeWinMap.get(rType) || 0;
			const label = soloTypeLabels[rType] || '';
			result[label] = count ? wins / count : 0;
		});
		return result;
	});
}

/**
 * Calculate average points by solo type per player (only for RE/solos)
 */
export function calculateAvgPointsBySoloType(agg: GameAggregates) {
	return agg.playerList.map((pl) => {
		const result: Record<string, any> = {
			player: pl.name,
			color: agg.playerColorMap.get(pl.id)
		};
		const soloTypeCountMap = agg.playerSoloTypeCounts.get(pl.id);
		const soloTypePointMap = agg.playerSoloTypePoints.get(pl.id);
		if (soloTypeCountMap && soloTypePointMap) {
			soloTypeOrder.forEach((rType) => {
				const label = soloTypeLabels[rType];
				if (label) {
					const count = soloTypeCountMap.get(rType) || 0;
					const points = soloTypePointMap.get(rType) || 0;
					result[label] = count > 0 ? points / count : 0;
				}
			});
		}
		return result;
	});
}

/**
 * Calculate team win rates (RE vs KONTRA)
 */
export function calculateTeamWinRates(agg: GameAggregates) {
	return agg.playerList.map((pl) => ({
		player: pl.name,
		reRate: agg.reRoundsPlayed.get(pl.id)
			? (agg.reRoundsWon.get(pl.id) || 0) / agg.reRoundsPlayed.get(pl.id)!
			: 0,
		kontraRate: agg.kontraRoundsPlayed.get(pl.id)
			? (agg.kontraRoundsWon.get(pl.id) || 0) / agg.kontraRoundsPlayed.get(pl.id)!
			: 0,
		color: agg.playerColorMap.get(pl.id)
	}));
}

/**
 * Calculate pair team counts (rounds played together)
 */
export function calculatePairTeamCounts(agg: GameAggregates) {
	return Array.from(agg.pairTeamRoundCounts.entries())
		.map(([key, value]) => ({
			key,
			value,
			color: (() => {
				const firstName = key.split(' & ')[0];
				const pl = agg.playerList.find((p) => p.name === firstName);
				return pl ? agg.playerColorMap.get(pl.id) : generateDistinctColorPalette(1)[0];
			})()
		}))
		.sort((a, b) => b.value - a.value);
}

/**
 * Get series definitions (for use in charts)
 */
export function getSoloTypeSeries(agg: GameAggregates) {
	return soloTypeOrder
		.filter((rType) => (agg.soloTypeCounts.get(rType) || 0) > 0)
		.map((rType) => ({
			key: soloTypeLabels[rType] || rType,
			label: soloTypeLabels[rType] || rType,
			color: soloTypeColors[rType]
		}));
}

export function getRoundTypeSeries() {
	return [
		{ key: 'normal', label: 'Normal', color: roundTypeColorPalette[0] },
		{ key: 'solo', label: 'Solo', color: roundTypeColorPalette[1] }
	];
}

export function getCallSeries() {
	return callSeries;
}

export function getBonusSeries() {
	return bonusSeries;
}

export function getReKontraSeries() {
	return reKontraSeries;
}

export function getReKontraRateSeries() {
	return reKontraRateSeries;
}

export function getReKontraAvgSeries() {
	return reKontraAvgSeries;
}

// ============================================================================
// MAIN ORCHESTRATOR
// Combines aggregation and all calculation functions into single result
// ============================================================================

/**
 * Pure calculation function. Takes a game with participants and rounds,
 * aggregates all statistics in a single pass, and returns typed result.
 * No I/O, no side effects. Testable without database.
 */
export function calculateGameStatistics(game: Game): GameStatistics {
	const agg = aggregateGameRounds(game);

	return {
		playerSeries: calculatePlayerSeries(agg),
		reKontraShare: calculateReKontraShare(agg),
		winLostShareByType: calculateWinLostShareByType(agg),
		avgReKontra: calculateAvgReKontra(agg),
		avgPairs: calculateAvgPairs(agg),
		pairTeamCounts: calculatePairTeamCounts(agg),
		bonusGrouped: calculateBonusGrouped(agg),
		avgEyesGrouped: calculateAvgEyesGrouped(agg),
		avgEyes: calculateAvgEyes(agg),
		callGrouped: calculateCallGrouped(agg),
		callSuccessRate: calculateCallSuccessRate(agg),
		roundsWon: calculateRoundsWon(agg),
		roundsByType: calculateRoundsByType(agg),
		soloRoundsByType: calculateSoloRoundsByType(agg),
		soloTypeShareByPlayer: calculateSoloTypeShareByPlayer(agg),
		soloTypeWinRateByPlayer: calculateSoloTypeWinRateByPlayer(agg),
		avgPointsByGameType: calculateAvgPointsByGameType(agg),
		avgPointsBySoloType: calculateAvgPointsBySoloType(agg),
		teamWinRates: calculateTeamWinRates(agg),
		soloTypeSeries: getSoloTypeSeries(agg),
		roundTypeSeries: getRoundTypeSeries(),
		callSeries: getCallSeries(),
		bonusSeries: getBonusSeries(),
		reKontraSeries: getReKontraSeries(),
		reKontraRateSeries: getReKontraRateSeries(),
		reKontraAvgSeries: getReKontraAvgSeries()
	};
}

/**
 * Orchestrator function. Fetches game via repository and delegates to calculateGameStatistics.
 * Handles authentication, error cases, and returns promise for streaming.
 */
export async function getGameStatistics({
	principalId,
	gameId,
	groupId,
	gameRepo
}: {
	principalId: string;
	gameId: string;
	groupId: string;
	gameRepo?: any;
}): Promise<GameStatistics> {
	const { GameRepository } = await import('$lib/server/repositories/game');
	const repo = gameRepo || new GameRepository(principalId);
	const gameResult = await repo.getById(gameId, groupId);

	if (!gameResult.ok) {
		throw error(gameResult.status, gameResult.error);
	}

	const game = gameResult.value;
	if (!game.rounds) {
		throw error(404, 'Spiel nicht gefunden.');
	}

	return calculateGameStatistics(game);
}
