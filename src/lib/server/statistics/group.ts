import { error } from '@sveltejs/kit';
import { CallType, RoundType } from '$lib/domain/enums';
import type { Game } from '$lib/domain/game';
import { generateDistinctColorPalette } from '$lib/utils/colors';
import { increment, soloTypeOrder } from './shared';
import {
	aggregateGameRounds,
	type GameAggregates,
	type GameStatistics,
	calculatePlayerSeries,
	calculateReKontraShare,
	calculateAvgReKontra,
	calculateAvgPairs,
	calculateBonusGrouped,
	calculateAvgEyes,
	calculateAvgEyesGrouped,
	calculateCallGrouped,
	calculateCallSuccessRate,
	calculateCallFScore,
	calculateMissedCallRate,
	calculateRoundsWon,
	calculateRoundsByType,
	calculateSoloRoundsByType,
	calculateWinLostShareByType,
	calculateAvgPointsByGameType,
	calculateSoloTypeShareByPlayer,
	calculateSoloTypeWinRateByPlayer,
	calculateAvgPointsBySoloType,
	calculateTeamWinRates,
	calculatePairTeamCounts,
	getSoloTypeSeries,
	getRoundTypeSeries,
	getCallSeries,
	getBonusSeries,
	getReKontraSeries,
	getReKontraRateSeries,
	getReKontraAvgSeries
} from './game';

export interface GroupStatistics extends GameStatistics {
	// Group-only additions
	gamesWon: Array<{ player: string; value: number; percent: number; color?: string }>;
	avgTotalPointsPerGame: Array<Record<string, any>>;
	playerSeriesByGame: GameStatistics['playerSeries'];
	gamesCount: number;
	roundsCount: number;
}

/**
 * Merged aggregates from multiple games.
 * Combines per-game aggregates into group-level aggregates by:
 * - Summing all raw counts and totals
 * - Preserving player list from all games
 * - Combining pair statistics across games
 */
export function mergeGameAggregates(gameAggregates: GameAggregates[]): GameAggregates {
	if (gameAggregates.length === 0) {
		// Return empty aggregates
		return {
			playerList: [],
			playerColorMap: new Map(),
			reCounts: new Map(),
			kontraCounts: new Map(),
			reTotals: new Map(),
			kontraTotals: new Map(),
			reCountsMap: new Map(),
			kontraCountsMap: new Map(),
			eyesTotals: new Map(),
			eyesCounts: new Map(),
			dokoCounts: new Map(),
			fuchsCounts: new Map(),
			karlchenCounts: new Map(),
			roundsWonCount: new Map(),
			reRoundsPlayed: new Map(),
			reRoundsWon: new Map(),
			kontraRoundsPlayed: new Map(),
			kontraRoundsWon: new Map(),
			normalWins: new Map(),
			normalTotal: new Map(),
			soloWins: new Map(),
			soloTotal: new Map(),
			normalTotals: new Map(),
			normalCounts: new Map(),
			soloTotals: new Map(),
			soloCounts: new Map(),
			playerSoloTypeCounts: new Map(),
			playerSoloTypeWins: new Map(),
			playerSoloTypePoints: new Map(),
			soloTypeCounts: new Map(),
			callCountsMap: {},
			callWinsMap: {},
			missedCallOpportunityMap: {},
			missedCallMap: {},
			pairs: [],
			pairTotals: new Map(),
			pairCounts: new Map(),
			pairTeamRoundCounts: new Map(),
			playerPointsMap: new Map(),
			totalNormalRounds: 0,
			totalSoloRounds: 0,
			rounds: []
		};
	}

	// Merge player lists - collect all unique players
	const playerMap = new Map<string, { id: string; name: string }>();
	for (const agg of gameAggregates) {
		for (const player of agg.playerList) {
			if (!playerMap.has(player.id)) {
				playerMap.set(player.id, player);
			}
		}
	}
	const playerList = Array.from(playerMap.values());

	// Generate new color map for merged aggregates
	const palette = generateDistinctColorPalette(playerList.length);
	const playerColorMap = new Map<string, string>();
	playerList.forEach((pl, idx) => playerColorMap.set(pl.id, palette[idx % palette.length]));

	// Initialize merged maps
	const reCounts = new Map<string, number>();
	const kontraCounts = new Map<string, number>();
	const reTotals = new Map<string, number>();
	const kontraTotals = new Map<string, number>();
	const reCountsMap = new Map<string, number>();
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
	soloTypeOrder.forEach((t) => soloTypeCounts.set(t, 0));

	const playerSoloTypeCounts = new Map<string, Map<RoundType, number>>();
	const playerSoloTypeWins = new Map<string, Map<RoundType, number>>();
	const playerSoloTypePoints = new Map<string, Map<RoundType, number>>();

	const callCountsMap: Record<string, Map<string, number>> = {};
	const callWinsMap: Record<string, Map<string, number>> = {};
	const missedCallOpportunityMap: Record<string, Map<string, number>> = {};
	const missedCallMap: Record<string, Map<string, number>> = {};

	// Initialize for all players
	for (const player of playerList) {
		reCounts.set(player.id, 0);
		kontraCounts.set(player.id, 0);
		reTotals.set(player.id, 0);
		kontraTotals.set(player.id, 0);
		reCountsMap.set(player.id, 0);
		kontraCountsMap.set(player.id, 0);
		eyesTotals.set(player.id, 0);
		eyesCounts.set(player.id, 0);
		dokoCounts.set(player.id, 0);
		fuchsCounts.set(player.id, 0);
		karlchenCounts.set(player.id, 0);
		roundsWonCount.set(player.id, 0);
		reRoundsPlayed.set(player.id, 0);
		reRoundsWon.set(player.id, 0);
		kontraRoundsPlayed.set(player.id, 0);
		kontraRoundsWon.set(player.id, 0);
		normalWins.set(player.id, 0);
		normalTotal.set(player.id, 0);
		soloWins.set(player.id, 0);
		soloTotal.set(player.id, 0);
		normalTotals.set(player.id, 0);
		normalCounts.set(player.id, 0);
		soloTotals.set(player.id, 0);
		soloCounts.set(player.id, 0);

		const soloTypeCountMap = new Map<RoundType, number>();
		const soloTypeWinMap = new Map<RoundType, number>();
		const soloTypePointMap = new Map<RoundType, number>();
		soloTypeOrder.forEach((t) => {
			soloTypeCountMap.set(t, 0);
			soloTypeWinMap.set(t, 0);
			soloTypePointMap.set(t, 0);
		});
		playerSoloTypeCounts.set(player.id, soloTypeCountMap);
		playerSoloTypeWins.set(player.id, soloTypeWinMap);
		playerSoloTypePoints.set(player.id, soloTypePointMap);

		const callMap = new Map<string, number>();
		const callWinMap = new Map<string, number>();
		const callTypes = [
			CallType.RE,
			CallType.KONTRA,
			CallType.Keine90,
			CallType.Keine60,
			CallType.Keine30,
			CallType.Schwarz
		];
		callTypes.forEach((ct) => {
			callMap.set(ct, 0);
			callWinMap.set(ct, 0);
		});
		callCountsMap[player.id] = callMap;
		callWinsMap[player.id] = callWinMap;

		const missedOpportunityMap = new Map<string, number>();
		const missedMap = new Map<string, number>();
		[CallType.Keine90, CallType.Keine60, CallType.Keine30, CallType.Schwarz].forEach((ct) => {
			missedOpportunityMap.set(ct, 0);
			missedMap.set(ct, 0);
		});
		missedCallOpportunityMap[player.id] = missedOpportunityMap;
		missedCallMap[player.id] = missedMap;
	}

	// Merge pairs
	const pairKeyToPlayers = new Map<
		string,
		{ a: { id: string; name: string }; b: { id: string; name: string } }
	>();
	for (const agg of gameAggregates) {
		for (const pair of agg.pairs) {
			const key = `${pair.a.name} & ${pair.b.name}`;
			if (!pairKeyToPlayers.has(key)) {
				pairKeyToPlayers.set(key, pair);
			}
		}
	}
	const pairs = Array.from(pairKeyToPlayers.values());

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

	// Merge all aggregates
	for (const agg of gameAggregates) {
		// Basic RE/KONTRA counts
		for (const [playerId, count] of agg.reCounts.entries()) {
			increment(reCounts, playerId, count);
		}
		for (const [playerId, count] of agg.kontraCounts.entries()) {
			increment(kontraCounts, playerId, count);
		}

		// Points totals
		for (const [playerId, total] of agg.reTotals.entries()) {
			increment(reTotals, playerId, total);
		}
		for (const [playerId, count] of agg.reCountsMap.entries()) {
			increment(reCountsMap, playerId, count);
		}
		for (const [playerId, total] of agg.kontraTotals.entries()) {
			increment(kontraTotals, playerId, total);
		}
		for (const [playerId, count] of agg.kontraCountsMap.entries()) {
			increment(kontraCountsMap, playerId, count);
		}

		// Eyes
		for (const [playerId, total] of agg.eyesTotals.entries()) {
			increment(eyesTotals, playerId, total);
		}
		for (const [playerId, count] of agg.eyesCounts.entries()) {
			increment(eyesCounts, playerId, count);
		}

		// Bonuses
		for (const [playerId, count] of agg.dokoCounts.entries()) {
			increment(dokoCounts, playerId, count);
		}
		for (const [playerId, count] of agg.fuchsCounts.entries()) {
			increment(fuchsCounts, playerId, count);
		}
		for (const [playerId, count] of agg.karlchenCounts.entries()) {
			increment(karlchenCounts, playerId, count);
		}

		// Wins
		for (const [playerId, count] of agg.roundsWonCount.entries()) {
			increment(roundsWonCount, playerId, count);
		}

		// Team rounds
		for (const [playerId, count] of agg.reRoundsPlayed.entries()) {
			increment(reRoundsPlayed, playerId, count);
		}
		for (const [playerId, count] of agg.reRoundsWon.entries()) {
			increment(reRoundsWon, playerId, count);
		}
		for (const [playerId, count] of agg.kontraRoundsPlayed.entries()) {
			increment(kontraRoundsPlayed, playerId, count);
		}
		for (const [playerId, count] of agg.kontraRoundsWon.entries()) {
			increment(kontraRoundsWon, playerId, count);
		}

		// Round type wins
		for (const [playerId, count] of agg.normalWins.entries()) {
			increment(normalWins, playerId, count);
		}
		for (const [playerId, count] of agg.normalTotal.entries()) {
			increment(normalTotal, playerId, count);
		}
		for (const [playerId, count] of agg.soloWins.entries()) {
			increment(soloWins, playerId, count);
		}
		for (const [playerId, count] of agg.soloTotal.entries()) {
			increment(soloTotal, playerId, count);
		}

		// Round type points
		for (const [playerId, total] of agg.normalTotals.entries()) {
			increment(normalTotals, playerId, total);
		}
		for (const [playerId, count] of agg.normalCounts.entries()) {
			increment(normalCounts, playerId, count);
		}
		for (const [playerId, total] of agg.soloTotals.entries()) {
			increment(soloTotals, playerId, total);
		}
		for (const [playerId, count] of agg.soloCounts.entries()) {
			increment(soloCounts, playerId, count);
		}

		// Solo types
		for (const [rType, count] of agg.soloTypeCounts.entries()) {
			increment(soloTypeCounts, rType, count);
		}
		for (const [playerId, soloTypeMap] of agg.playerSoloTypeCounts.entries()) {
			const mergedMap = playerSoloTypeCounts.get(playerId);
			if (mergedMap) {
				for (const [rType, count] of soloTypeMap.entries()) {
					increment(mergedMap, rType, count);
				}
			}
		}
		for (const [playerId, soloTypeWinMap] of agg.playerSoloTypeWins.entries()) {
			const mergedMap = playerSoloTypeWins.get(playerId);
			if (mergedMap) {
				for (const [rType, count] of soloTypeWinMap.entries()) {
					increment(mergedMap, rType, count);
				}
			}
		}
		for (const [playerId, soloTypePointMap] of agg.playerSoloTypePoints.entries()) {
			const mergedMap = playerSoloTypePoints.get(playerId);
			if (mergedMap) {
				for (const [rType, total] of soloTypePointMap.entries()) {
					increment(mergedMap, rType, total);
				}
			}
		}

		// Calls
		for (const [playerId, callMap] of Object.entries(agg.callCountsMap)) {
			const mergedCallMap = callCountsMap[playerId];
			if (mergedCallMap) {
				for (const [callType, count] of callMap.entries()) {
					increment(mergedCallMap, callType, count);
				}
			}
		}
		for (const [playerId, callWinMap] of Object.entries(agg.callWinsMap)) {
			const mergedWinMap = callWinsMap[playerId];
			if (mergedWinMap) {
				for (const [callType, count] of callWinMap.entries()) {
					increment(mergedWinMap, callType, count);
				}
			}
		}

		for (const [playerId, opportunityMap] of Object.entries(agg.missedCallOpportunityMap)) {
			const mergedOpportunityMap = missedCallOpportunityMap[playerId];
			if (mergedOpportunityMap) {
				for (const [callType, count] of opportunityMap.entries()) {
					increment(mergedOpportunityMap, callType, count);
				}
			}
		}

		for (const [playerId, missedMap] of Object.entries(agg.missedCallMap)) {
			const mergedMissedMap = missedCallMap[playerId];
			if (mergedMissedMap) {
				for (const [callType, count] of missedMap.entries()) {
					increment(mergedMissedMap, callType, count);
				}
			}
		}

		// Pair statistics
		for (const [key, total] of agg.pairTotals.entries()) {
			pairTotals.set(key, (pairTotals.get(key) || 0) + total);
		}
		for (const [key, count] of agg.pairCounts.entries()) {
			pairCounts.set(key, (pairCounts.get(key) || 0) + count);
		}
		for (const [key, count] of agg.pairTeamRoundCounts.entries()) {
			pairTeamRoundCounts.set(key, (pairTeamRoundCounts.get(key) || 0) + count);
		}

		// Round totals
		totalNormalRounds += agg.totalNormalRounds;
		totalSoloRounds += agg.totalSoloRounds;
	}

	// For cumulative points, we don't carry over across games, so we skip playerPointsMap
	const playerPointsMap = new Map<string, Array<{ round: number; cumulativePoints: number }>>();
	for (const player of playerList) {
		playerPointsMap.set(player.id, []);
	}

	// Rounds are also per-game, so we collect unique round numbers across all games
	const roundSet = new Set<number>();
	for (const agg of gameAggregates) {
		for (const round of agg.rounds) {
			roundSet.add(round);
		}
	}
	const rounds = Array.from(roundSet).sort((a, b) => a - b);

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
		missedCallOpportunityMap,
		missedCallMap,
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

/**
 * Calculate group-level statistics from multiple games.
 * Reuses all game-level calculation functions on merged aggregates.
 */
export function calculateGroupStatistics(games: Game[]): GroupStatistics {
	const finishedGames = games.filter((g) => g.isFinished());

	// Aggregate each game individually
	const gameAggregates = finishedGames.map((g) => aggregateGameRounds(g));

	// Merge all aggregates into group aggregates
	const agg = mergeGameAggregates(gameAggregates);

	// Reuse game calculation functions on merged aggregates
	const baseStats = {
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
		missedCallRate: calculateMissedCallRate(agg),
		callFScore: calculateCallFScore(agg),
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

	// Calculate group-only statistics
	const groupStats = calculateGroupOnlyStatistics(agg, finishedGames);

	return {
		...baseStats,
		...groupStats
	};
}

/**
 * Calculate group-only statistics (games played, games won, consistency, etc.)
 */
function calculateGroupOnlyStatistics(
	agg: GameAggregates,
	games: Game[]
): {
	gamesWon: Array<{ player: string; value: number; percent: number; color?: string }>;
	avgTotalPointsPerGame: Array<Record<string, any>>;
	playerSeriesByGame: GameStatistics['playerSeries'];
	gamesCount: number;
	roundsCount: number;
} {
	// Count games played per player
	const gamesPlayedMap = new Map<string, number>();
	const perPlayerPointsPerGame = new Map<string, number[]>();
	const gamesWonMap = new Map<string, number>(); // only players with top score in a game get a win
	const gamesWithPoints: Array<{
		order: number;
		game: Game;
		playerGamePoints: Map<string, number>;
	}> = [];
	let gamesWithRounds = 0; // Count games that actually have rounds

	for (const player of agg.playerList) {
		gamesPlayedMap.set(player.id, 0);
		perPlayerPointsPerGame.set(player.id, []);
		gamesWonMap.set(player.id, 0);
	}

	for (const [order, game] of games.entries()) {
		// Skip games with no rounds
		if (!game.rounds || game.rounds.length === 0) {
			continue;
		}

		gamesWithRounds++;
		const playerGamePoints = new Map<string, number>();
		for (const participant of game.participants || []) {
			if (!participant.player) continue;
			playerGamePoints.set(participant.player.id, 0);
		}

		for (const round of game.rounds || []) {
			const roundPoints = round.calculatePoints();
			for (const rp of roundPoints) {
				playerGamePoints.set(rp.playerId, (playerGamePoints.get(rp.playerId) || 0) + rp.points);
			}
		}

		gamesWithPoints.push({ order, game, playerGamePoints });

		// Track games played and points per game
		for (const [playerId, points] of playerGamePoints.entries()) {
			increment(gamesPlayedMap, playerId);
			const playerPoints = perPlayerPointsPerGame.get(playerId);
			if (playerPoints) {
				playerPoints.push(points);
			}
		}

		// Determine game winners: players with the highest total points in this game
		const scores = Array.from(playerGamePoints.values());
		if (scores.length > 0) {
			const maxScore = Math.max(...scores);
			for (const [playerId, points] of playerGamePoints.entries()) {
				if (points === maxScore) {
					increment(gamesWonMap, playerId);
				}
			}
		}
	}

	// Format results
	const gamesWon = agg.playerList
		.filter((pl) => (gamesPlayedMap.get(pl.id) || 0) > 0)
		.map((pl) => {
			const value = gamesWonMap.get(pl.id) || 0;
			return {
				player: pl.name,
				value,
				percent: games.length > 0 ? value / games.length : 0,
				color: agg.playerColorMap.get(pl.id)
			};
		});

	// Average total points per game
	const avgTotalPointsPerGame = agg.playerList
		.filter((pl) => (gamesPlayedMap.get(pl.id) || 0) > 0)
		.map((pl) => {
			const playerPoints = perPlayerPointsPerGame.get(pl.id) || [];
			const avg =
				playerPoints.length > 0 ? playerPoints.reduce((a, b) => a + b, 0) / playerPoints.length : 0;
			return {
				player: pl.name,
				[pl.name]: avg,
				color: agg.playerColorMap.get(pl.id)
			} as Record<string, any>;
		});

	const playersWithGames = agg.playerList.filter((pl) => (gamesPlayedMap.get(pl.id) || 0) > 0);
	const sortedGamesWithPoints = [...gamesWithPoints].sort(
		(a, b) => a.game.endedAt!.getTime() - b.game.endedAt!.getTime() || a.order - b.order
	);

	const cumulativeTotals = new Map<string, number>();
	for (const player of playersWithGames) {
		cumulativeTotals.set(player.id, 0);
	}

	const playerSeriesByGameRows = sortedGamesWithPoints.map(({ game, playerGamePoints }) => {
		const row: Record<string, any> = {
			date: new Date(game.endedAt!)
		};
		for (const player of playersWithGames) {
			const currentTotal = cumulativeTotals.get(player.id) || 0;
			const nextTotal = currentTotal + (playerGamePoints.get(player.id) || 0);
			cumulativeTotals.set(player.id, nextTotal);
			row[player.name] = nextTotal;
		}
		return row;
	});

	const playerSeriesByGame = {
		rows: playerSeriesByGameRows,
		series: playersWithGames.map((pl) => ({
			key: pl.name,
			label: pl.name,
			color: agg.playerColorMap.get(pl.id)
		}))
	};

	const totalRounds = agg.totalNormalRounds + agg.totalSoloRounds;
	console.log(playerSeriesByGame);
	return {
		gamesWon,
		avgTotalPointsPerGame,
		playerSeriesByGame,
		gamesCount: gamesWithRounds,
		roundsCount: totalRounds
	};
}

/**
 * Fetch and calculate group statistics from repository
 */
export async function getGroupStatistics({
	principalId,
	groupId,
	gameRepo
}: {
	principalId: string;
	groupId: string;
	gameRepo?: any;
}): Promise<GroupStatistics> {
	const { GameRepository } = await import('$lib/server/repositories/game');
	const repo = gameRepo || new GameRepository(principalId);
	const gamesResult = await repo.listByGroup(groupId);

	if (!gamesResult.ok) {
		throw error(gamesResult.status, gamesResult.error);
	}

	// Fetch full game objects
	const fullGames: Game[] = [];
	for (const gameStub of gamesResult.value) {
		const gameResult = await repo.getById(gameStub.id, groupId);
		if (gameResult.ok) {
			fullGames.push(gameResult.value);
		}
	}

	return calculateGroupStatistics(fullGames);
}
