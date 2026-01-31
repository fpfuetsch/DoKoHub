import { error } from '@sveltejs/kit';
import type { Game } from '$lib/domain/game';
import type { Group } from '$lib/domain/group';
import {
	aggregateGameRounds,
	type GameAggregates,
	calculateReKontraShare,
	calculateAvgReKontra,
	calculateBonusGrouped,
	calculateCallGrouped,
	calculateCallSuccessRate,
	calculateRoundsWon,
	calculateWinLostShareByType,
	calculateAvgPointsByGameType,
	calculateSoloTypeShareByPlayer,
	calculateSoloTypeWinRateByPlayer,
	calculateAvgPointsBySoloType,
	calculateTeamWinRates,
	getSoloTypeSeries,
	getRoundTypeSeries,
	getCallSeries,
	getBonusSeries,
	getReKontraSeries,
	getReKontraRateSeries,
	getReKontraAvgSeries
} from './game';
import { mergeGameAggregates } from './group';
import { increment } from './shared';

/**
 * Player-specific statistics across all groups and games
 */
export interface PlayerStatistics {
	// Overview
	totalGames: number;
	totalRounds: number;
	gamesWon: number;
	gamesPlayed: number;
	avgPointsPerGame: number;

	// Round statistics
	roundsWon: Array<{ player: string; value: number; percent: number; color?: string }>;

	// Round type performance
	winLostShareByType: Array<Record<string, any>>;
	avgPointsByGameType: Array<Record<string, any>>;

	// Solo statistics
	soloTypeShareByPlayer: Array<Record<string, any>>;
	soloTypeWinRateByPlayer: Array<Record<string, any>>;
	avgPointsBySoloType: Array<Record<string, any>>;

	// Team play
	reKontraShare: Array<Record<string, any>>;
	teamWinRates: Array<Record<string, any>>;
	avgReKontra: Array<Record<string, any>>;

	// Bonuses and calls
	bonusGrouped: Array<Record<string, any>>;
	callGrouped: Array<Record<string, any>>;
	callSuccessRate: Array<Record<string, any>>;

	// Series for legends
	soloTypeSeries: Array<{ key: string; label: string; color?: string }>;
	roundTypeSeries: Array<{ key: string; label: string; color: string }>;
	callSeries: Array<{ key: string; label: string; color: string }>;
	bonusSeries: Array<{ key: string; label: string; color: string }>;
	reKontraSeries: Array<{ key: string; label: string; color: string }>;
	reKontraRateSeries: Array<{ key: string; label: string; color: string }>;
	reKontraAvgSeries: Array<{ key: string; label: string; color: string }>;
}

/**
 * Calculate comprehensive player statistics across all games from all groups
 */
export function calculatePlayerStatistics(
	playerId: string,
	playerName: string,
	allGames: Game[],
	groups: Group[]
): PlayerStatistics {
	// Filter games where player participated and game is finished
	const playerGames = allGames.filter(
		(game) =>
			game.isFinished() && game.participants.some((p) => p.player && p.player.id === playerId)
	);

	if (playerGames.length === 0) {
		// Return empty statistics
		return createEmptyStatistics();
	}

	// Aggregate all game rounds for this player
	const gameAggregates = playerGames.map((game) => aggregateGameRounds(game));
	const mergedAgg = mergeGameAggregates(gameAggregates);

	// Filter aggregates to only include this player's data
	const playerOnlyAgg = filterAggregatesForPlayer(mergedAgg, playerId);

	// Calculate game-level statistics
	const { gamesWon, gamesPlayed, totalPoints } = calculatePlayerGameStats(playerId, playerGames);

	// Calculate overview metrics
	const normalRoundsPlayed = playerOnlyAgg.normalCounts.get(playerId) ?? 0;
	const soloRoundsPlayed = playerOnlyAgg.soloCounts.get(playerId) ?? 0;
	const totalRounds = normalRoundsPlayed + soloRoundsPlayed;
	const avgPointsPerGame = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

	// Calculate all statistics using the filtered aggregates
	return {
		totalGames: gamesPlayed,
		totalRounds,
		gamesWon,
		gamesPlayed,
		avgPointsPerGame,

		// Round statistics
		roundsWon: calculateRoundsWon(playerOnlyAgg),

		// Performance by type
		winLostShareByType: calculateWinLostShareByType(playerOnlyAgg),
		avgPointsByGameType: calculateAvgPointsByGameType(playerOnlyAgg),

		// Solo statistics
		soloTypeShareByPlayer: calculateSoloTypeShareByPlayer(playerOnlyAgg),
		soloTypeWinRateByPlayer: calculateSoloTypeWinRateByPlayer(playerOnlyAgg),
		avgPointsBySoloType: calculateAvgPointsBySoloType(playerOnlyAgg),

		// Team play
		reKontraShare: calculateReKontraShare(playerOnlyAgg),
		teamWinRates: calculateTeamWinRates(playerOnlyAgg),
		avgReKontra: calculateAvgReKontra(playerOnlyAgg),

		// Bonuses and calls
		bonusGrouped: calculateBonusGrouped(playerOnlyAgg),
		callGrouped: calculateCallGrouped(playerOnlyAgg),
		callSuccessRate: calculateCallSuccessRate(playerOnlyAgg),

		// Series
		soloTypeSeries: getSoloTypeSeries(playerOnlyAgg),
		roundTypeSeries: getRoundTypeSeries(),
		callSeries: getCallSeries(),
		bonusSeries: getBonusSeries(),
		reKontraSeries: getReKontraSeries(),
		reKontraRateSeries: getReKontraRateSeries(),
		reKontraAvgSeries: getReKontraAvgSeries()
	};
}

/**
 * Filter aggregates to only include data for a specific player
 */
function filterAggregatesForPlayer(agg: GameAggregates, playerId: string): GameAggregates {
	// Keep only the player in the player list
	const player = agg.playerList.find((p) => p.id === playerId);
	if (!player) {
		return createEmptyAggregates();
	}

	const playerList = [player];
	const playerColorMap = new Map([[playerId, agg.playerColorMap.get(playerId) || '#000']]);

	// Helper to filter map
	const filterMap = <T>(map: Map<string, T>): Map<string, T> => {
		const filtered = new Map<string, T>();
		const value = map.get(playerId);
		if (value !== undefined) {
			filtered.set(playerId, value);
		}
		return filtered;
	};

	return {
		playerList,
		playerColorMap,
		reCounts: filterMap(agg.reCounts),
		kontraCounts: filterMap(agg.kontraCounts),
		reTotals: filterMap(agg.reTotals),
		kontraTotals: filterMap(agg.kontraTotals),
		reCountsMap: filterMap(agg.reCountsMap),
		kontraCountsMap: filterMap(agg.kontraCountsMap),
		eyesTotals: filterMap(agg.eyesTotals),
		eyesCounts: filterMap(agg.eyesCounts),
		dokoCounts: filterMap(agg.dokoCounts),
		fuchsCounts: filterMap(agg.fuchsCounts),
		karlchenCounts: filterMap(agg.karlchenCounts),
		roundsWonCount: filterMap(agg.roundsWonCount),
		reRoundsPlayed: filterMap(agg.reRoundsPlayed),
		reRoundsWon: filterMap(agg.reRoundsWon),
		kontraRoundsPlayed: filterMap(agg.kontraRoundsPlayed),
		kontraRoundsWon: filterMap(agg.kontraRoundsWon),
		normalWins: filterMap(agg.normalWins),
		normalTotal: filterMap(agg.normalTotal),
		soloWins: filterMap(agg.soloWins),
		soloTotal: filterMap(agg.soloTotal),
		normalTotals: filterMap(agg.normalTotals),
		normalCounts: filterMap(agg.normalCounts),
		soloTotals: filterMap(agg.soloTotals),
		soloCounts: filterMap(agg.soloCounts),
		playerSoloTypeCounts: filterMap(agg.playerSoloTypeCounts),
		playerSoloTypeWins: filterMap(agg.playerSoloTypeWins),
		playerSoloTypePoints: filterMap(agg.playerSoloTypePoints),
		soloTypeCounts: agg.playerSoloTypeCounts.get(playerId) || new Map(),
		callCountsMap: { [playerId]: agg.callCountsMap[playerId] || new Map() },
		callWinsMap: { [playerId]: agg.callWinsMap[playerId] || new Map() },
		pairs: [],
		pairTotals: new Map(),
		pairCounts: new Map(),
		pairTeamRoundCounts: new Map(),
		playerPointsMap: filterMap(agg.playerPointsMap),
		totalNormalRounds: agg.normalTotal.get(playerId) ?? 0,
		totalSoloRounds: agg.soloTotal.get(playerId) ?? 0,
		rounds: agg.rounds
	};
}

/**
 * Calculate game-level statistics for a player
 */
function calculatePlayerGameStats(
	playerId: string,
	games: Game[]
): {
	gamesWon: number;
	gamesPlayed: number;
	totalPoints: number;
} {
	let gamesWon = 0;
	let gamesPlayed = 0;
	let totalPoints = 0;

	for (const game of games) {
		if (!game.rounds || game.rounds.length === 0) {
			continue;
		}

		// Check if player participated
		const participated = game.participants.some((p) => p.player && p.player.id === playerId);
		if (!participated) {
			continue;
		}

		gamesPlayed++;

		// Calculate total points for each player in this game
		const playerGamePoints = new Map<string, number>();
		for (const participant of game.participants) {
			if (!participant.player) continue;
			playerGamePoints.set(participant.player.id, 0);
		}

		for (const round of game.rounds) {
			const roundPoints = round.calculatePoints();
			for (const rp of roundPoints) {
				playerGamePoints.set(rp.playerId, (playerGamePoints.get(rp.playerId) || 0) + rp.points);
			}
		}

		// Get player's points and total
		const playerPoints = playerGamePoints.get(playerId) || 0;
		totalPoints += playerPoints;

		// Check if player won (had highest score)
		const scores = Array.from(playerGamePoints.values());
		const maxScore = Math.max(...scores);
		if (playerPoints === maxScore) {
			gamesWon++;
		}
	}

	return { gamesWon, gamesPlayed, totalPoints };
}

/**
 * Create empty statistics when no data is available
 */
function createEmptyStatistics(): PlayerStatistics {
	return {
		totalGames: 0,
		totalRounds: 0,
		gamesWon: 0,
		gamesPlayed: 0,
		avgPointsPerGame: 0,
		roundsWon: [],
		winLostShareByType: [],
		avgPointsByGameType: [],
		soloTypeShareByPlayer: [],
		soloTypeWinRateByPlayer: [],
		avgPointsBySoloType: [],
		reKontraShare: [],
		teamWinRates: [],
		avgReKontra: [],
		bonusGrouped: [],
		callGrouped: [],
		callSuccessRate: [],
		soloTypeSeries: [],
		roundTypeSeries: [],
		callSeries: [],
		bonusSeries: [],
		reKontraSeries: [],
		reKontraRateSeries: [],
		reKontraAvgSeries: []
	};
}

/**
 * Create empty aggregates
 */
function createEmptyAggregates(): GameAggregates {
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

/**
 * Fetch and calculate player statistics from all groups
 */
export async function getPlayerStatistics({
	principalId
}: {
	principalId: string;
}): Promise<PlayerStatistics> {
	const { GroupRepository } = await import('$lib/server/repositories/group');
	const { GameRepository } = await import('$lib/server/repositories/game');
	const { PlayerRepository } = await import('$lib/server/repositories/player');

	const groupRepo = new GroupRepository(principalId);
	const gameRepo = new GameRepository(principalId);
	const playerRepo = new PlayerRepository(principalId);

	// Get player info
	const player = await playerRepo.getById(principalId);
	if (!player) {
		throw error(404, 'Spieler nicht gefunden');
	}

	// Get all groups the player is a member of
	const groups = await groupRepo.list();

	// Fetch all games from all groups
	const allGames: Game[] = [];
	for (const group of groups) {
		const gamesResult = await gameRepo.listByGroup(group.id);
		if (gamesResult.ok) {
			// Fetch full game data with rounds
			for (const gameStub of gamesResult.value) {
				const gameResult = await gameRepo.getById(gameStub.id, group.id);
				if (gameResult.ok) {
					allGames.push(gameResult.value);
				}
			}
		}
	}

	return calculatePlayerStatistics(principalId, player.displayName, allGames, groups);
}
