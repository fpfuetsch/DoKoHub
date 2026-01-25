import { error } from '@sveltejs/kit';
import { Team, BonusType, CallType, RoundType } from '$lib/domain/enums';
import { GameRepository } from '$lib/server/repositories/game';
import type { Game } from '$lib/domain/game';
import { generateDistinctColorPalette } from '$lib/utils/colors';
import {
	bonusSeries,
	callSeries,
	increment,
	roundTypeColorPalette,
	soloTypeColors,
	soloTypeLabels,
	soloTypeOrder
} from './shared';

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
		hochzeitWinShare: number;
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
	roundTypeShareByPlayer: Array<{
		player: string;
		normalShare: number;
		hochzeitShare: number;
		soloShare: number;
		color?: string;
	}>;
	soloTypeShareByPlayer: Array<Record<string, any>>;
	soloTypeWinRateByPlayer: Array<Record<string, any>>;
	avgPointsByGameType: Array<{
		player: string;
		normal: number;
		hochzeit: number;
		solo: number;
		color?: string;
	}>;
	avgPointsBySoloType: Array<Record<string, any>>;
	teamWinRates: Array<{ player: string; reRate: number; kontraRate: number; color?: string }>;
	soloTypeSeries: Array<{ key: string; label: string; color?: string }>;
	roundTypeSeries: Array<{ key: string; label: string; color?: string }>;
	callSeries: Array<{ key: string; label: string; color?: string }>;
	bonusSeries: Array<{ key: string; label: string; color?: string }>;
}

// Shared palettes and helpers are imported from statistics/shared

/**
 * Pure calculation function. Takes a game with participants and rounds,
 * aggregates all statistics, and returns typed result.
 * No I/O, no side effects. Testable without database.
 */
export function calculateGameStatistics(game: Game): GameStatistics {
	// Prepare player list and color map
	const rounds = Array.from(new Set(game.rounds.map((r) => r.roundNumber))).sort((a, b) => a - b);
	const playerList = game.participants
		.filter((p) => p.player)
		.map((p) => ({
			id: p.player!.id,
			name: p.player!.getTruncatedDisplayName() || 'Unknown'
		}))
		.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name for consistent color assignment

	// Generate color palette based on actual number of players
	const palette = generateDistinctColorPalette(playerList.length);

	const playerColorMap = new Map<string, string>();
	playerList.forEach((pl, idx) => playerColorMap.set(pl.id, palette[idx % palette.length]));

	// Initialize per-player aggregates
	const playerPointsMap = new Map<string, { round: number; cumulativePoints: number }[]>();
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

	// Round type tracking
	const normalWins = new Map<string, number>();
	const normalTotal = new Map<string, number>();
	const hochzeitWins = new Map<string, number>();
	const hochzeitTotal = new Map<string, number>();
	const soloWins = new Map<string, number>();
	const soloTotal = new Map<string, number>();
	const normalTotals = new Map<string, number>();
	const normalCounts = new Map<string, number>();
	const hochzeitTotals = new Map<string, number>();
	const hochzeitCounts = new Map<string, number>();
	const soloTotals = new Map<string, number>();
	const soloCounts = new Map<string, number>();
	const playerNormalCount = new Map<string, number>();
	const playerHochzeitCount = new Map<string, number>();
	const playerSoloParticipationCount = new Map<string, number>(); // counts solo rounds participation for round-share
	const playerSoloCount = new Map<string, number>();

	// Solo type tracking
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
		hochzeitWins.set(pl.id, 0);
		hochzeitTotal.set(pl.id, 0);
		soloWins.set(pl.id, 0);
		soloTotal.set(pl.id, 0);
		normalTotals.set(pl.id, 0);
		normalCounts.set(pl.id, 0);
		hochzeitTotals.set(pl.id, 0);
		hochzeitCounts.set(pl.id, 0);
		soloTotals.set(pl.id, 0);
		soloCounts.set(pl.id, 0);
		playerNormalCount.set(pl.id, 0);
		playerHochzeitCount.set(pl.id, 0);
		playerSoloParticipationCount.set(pl.id, 0);
		playerSoloCount.set(pl.id, 0);

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

	// Prepare unordered player pairs for pair-averages
	const pairs: { a: { id: string; name: string }; b: { id: string; name: string } }[] = [];
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

	// Track round type totals
	let totalNormalRounds = 0;
	let totalHochzeitRounds = 0;
	let totalSoloRounds = 0;

	// Single pass over rounds to compute all aggregates
	for (const round of game.rounds) {
		const roundPoints = round.calculatePoints();
		const eyesRe = round.eyesRe ?? 0;
		const rType = (round as any).type as RoundType;
		const category: 'normal' | 'hochzeit' | 'solo' =
			rType === RoundType.Normal
				? 'normal'
				: rType === RoundType.HochzeitNormal
					? 'hochzeit'
					: 'solo';

		// Count total rounds by type
		if (category === 'normal') totalNormalRounds++;
		else if (category === 'hochzeit') totalHochzeitRounds++;
		else {
			totalSoloRounds++;
			increment(soloTypeCounts, rType);
		}

		// Map participant -> team for this round and process participant-level aggregates
		const teamMap = new Map<string, string>();
		for (const participant of round.participants) {
			teamMap.set(participant.playerId, participant.team);

			// Track per-player round type counts
			if (category === 'normal') increment(playerNormalCount, participant.playerId);
			else if (category === 'hochzeit') increment(playerHochzeitCount, participant.playerId);
			else {
				// Count solo participation for round-type share regardless of team
				increment(playerSoloParticipationCount, participant.playerId);
				// Only count solo-type stats for the RE player
				if (participant.team === Team.RE) {
					increment(playerSoloCount, participant.playerId);
					const soloTypeMap = playerSoloTypeCounts.get(participant.playerId);
					if (soloTypeMap) increment(soloTypeMap, rType);
				}
			}

			// re/kontra counts
			if (participant.team === Team.RE) {
				increment(reCounts, participant.playerId);
				increment(reRoundsPlayed, participant.playerId);
			} else if (participant.team === Team.KONTRA) {
				increment(kontraCounts, participant.playerId);
				increment(kontraRoundsPlayed, participant.playerId);
			}

			// bonuses
			(participant.bonuses || []).forEach((b: any) => {
				if (b.bonusType === BonusType.Doko) {
					increment(dokoCounts, participant.playerId, b.count || 0);
				} else if (b.bonusType === BonusType.Fuchs) {
					increment(fuchsCounts, participant.playerId, b.count || 0);
				} else if (b.bonusType === BonusType.Karlchen) {
					increment(karlchenCounts, participant.playerId, b.count || 0);
				}
			});

			// calls
			(participant.calls || []).forEach((c: any) => {
				const m = callCountsMap[participant.playerId];
				if (!m) return;
				increment(m, c.callType);
			});

			// eyes (team achieved)
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

		// update cumulative points and per-player round stats
		for (const rp of roundPoints) {
			const playerHistory = playerPointsMap.get(rp.playerId) || [];
			const lastCumulative =
				playerHistory.length > 0 ? playerHistory[playerHistory.length - 1].cumulativePoints : 0;
			playerHistory.push({
				round: round.roundNumber,
				cumulativePoints: lastCumulative + rp.points
			});
			playerPointsMap.set(rp.playerId, playerHistory);

			// win counts
			if (rp.points > 0) {
				increment(roundsWonCount, rp.playerId);

				// Track call success (if player won the round)
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
				} else if (category === 'hochzeit') {
					increment(hochzeitWins, rp.playerId);
				} else {
					// Only count solo wins for RE player
					const team = teamMap.get(rp.playerId);
					if (team === Team.RE) {
						increment(soloWins, rp.playerId);
						const soloTypeWinMap = playerSoloTypeWins.get(rp.playerId);
						if (soloTypeWinMap) increment(soloTypeWinMap, rType);
					}
				}

				// Track team win rates
				const team = teamMap.get(rp.playerId);
				if (team === Team.RE) {
					increment(reRoundsWon, rp.playerId);
				} else if (team === Team.KONTRA) {
					increment(kontraRoundsWon, rp.playerId);
				}
			}

			// Track participation in round types
			if (category === 'normal') {
				increment(normalTotal, rp.playerId);
				increment(normalTotals, rp.playerId, rp.points);
				increment(normalCounts, rp.playerId);
			} else if (category === 'hochzeit') {
				increment(hochzeitTotal, rp.playerId);
				increment(hochzeitTotals, rp.playerId, rp.points);
				increment(hochzeitCounts, rp.playerId);
			} else {
				increment(soloTotal, rp.playerId);
				increment(soloTotals, rp.playerId, rp.points);
				increment(soloCounts, rp.playerId);
				// Only track solo type points for RE player
				const team = teamMap.get(rp.playerId);
				if (team === Team.RE) {
					const soloTypePointMap = playerSoloTypePoints.get(rp.playerId);
					if (soloTypePointMap) increment(soloTypePointMap, rType, rp.points);
				}
			}

			// avg re/kontra totals
			const team = teamMap.get(rp.playerId);
			if (team === Team.RE) {
				increment(reTotals, rp.playerId, rp.points);
				increment(reCountsMap, rp.playerId);
			} else if (team === Team.KONTRA) {
				increment(kontraTotals, rp.playerId, rp.points);
				increment(kontraCountsMap, rp.playerId);
			}
		}

		// pair totals
		const rpMap = new Map(roundPoints.map((rp) => [rp.playerId, rp.points] as const));
		for (const pair of pairs) {
			const key = `${pair.a.name} & ${pair.b.name}`;
			const aPoints = rpMap.get(pair.a.id) ?? 0;
			const bPoints = rpMap.get(pair.b.id) ?? 0;
			pairTotals.set(key, (pairTotals.get(key) || 0) + aPoints + bPoints);
			pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
		}
	}

	// Build rows from cumulative points map
	// Track last known cumulative points for each player to handle 5-player games
	// where a player (dealer) doesn't participate in a round
	const lastCumulativePerPlayer = new Map<string, number>();
	const rows = rounds.map((roundNum) => {
		const row: Record<string, number | null> = { round: roundNum };
		for (const [playerId, history] of playerPointsMap.entries()) {
			const playerEntry = playerList.find((p) => p.id === playerId);
			const playerName = playerEntry?.name || playerId;
			const pointEntry = history.find((h) => h.round === roundNum);

			if (pointEntry) {
				// Player participated in this round
				row[playerName] = pointEntry.cumulativePoints;
				lastCumulativePerPlayer.set(playerId, pointEntry.cumulativePoints);
			} else {
				// Player didn't participate (e.g., was dealer in 5-player game)
				// Carry forward their previous cumulative points
				const lastPoints = lastCumulativePerPlayer.get(playerId);
				row[playerName] = lastPoints !== undefined ? lastPoints : 0;
			}
		}
		return row;
	});

	// Series config
	const series = playerList.map((pl) => ({
		key: pl.name,
		label: pl.name,
		color: playerColorMap.get(pl.id)
	}));

	// Compute grouped results from aggregated maps
	const reKontraShare = playerList.map((pl) => {
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

	const avgReKontra = playerList.map((pl) => ({
		key: pl.name,
		reAvg: reCountsMap.get(pl.id) ? reTotals.get(pl.id)! / (reCountsMap.get(pl.id) || 1) : 0,
		kontraAvg: kontraCountsMap.get(pl.id)
			? kontraTotals.get(pl.id)! / (kontraCountsMap.get(pl.id) || 1)
			: 0,
		color: playerColorMap.get(pl.id)
	}));

	const avgPairs = Array.from(pairTotals.entries())
		.map(([key, total]) => ({
			key,
			value: total / (pairCounts.get(key) || 1),
			color: (() => {
				const firstName = key.split(' & ')[0];
				const pl = playerList.find((p) => p.name === firstName);
				return pl ? playerColorMap.get(pl.id) : palette[0];
			})()
		}))
		.sort((a, b) => b.value - a.value);

	const bonusGrouped = playerList.map((pl) => ({
		player: pl.name,
		doko: dokoCounts.get(pl.id) || 0,
		fuchs: fuchsCounts.get(pl.id) || 0,
		karlchen: karlchenCounts.get(pl.id) || 0,
		color: playerColorMap.get(pl.id)
	}));

	const avgEyes = playerList.map((pl) => ({
		player: pl.name,
		avgEyes: eyesCounts.get(pl.id) ? eyesTotals.get(pl.id)! / (eyesCounts.get(pl.id) || 1) : 0,
		color: playerColorMap.get(pl.id)
	}));

	const avgEyesGrouped = playerList.map((pl) => {
		const found = avgEyes.find((a) => a.player === pl.name);
		return {
			player: pl.name,
			[pl.name]: found ? found.avgEyes : 0,
			color: playerColorMap.get(pl.id)
		} as Record<string, any>;
	});

	const callGrouped = playerList.map((pl) => ({
		player: pl.name,
		RE: callCountsMap[pl.id].get(CallType.RE) || 0,
		KONTRA: callCountsMap[pl.id].get(CallType.KONTRA) || 0,
		Keine90: callCountsMap[pl.id].get(CallType.Keine90) || 0,
		Keine60: callCountsMap[pl.id].get(CallType.Keine60) || 0,
		Keine30: callCountsMap[pl.id].get(CallType.Keine30) || 0,
		Schwarz: callCountsMap[pl.id].get(CallType.Schwarz) || 0,
		color: playerColorMap.get(pl.id)
	}));

	// Call success rate
	const callSuccessRate = playerList.map((pl) => {
		const calcRate = (callType: CallType) => {
			const count = callCountsMap[pl.id].get(callType) || 0;
			const wins = callWinsMap[pl.id].get(callType) || 0;
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
			color: playerColorMap.get(pl.id)
		};
	});

	// Rounds won pie chart
	const totalRoundsWon = Array.from(roundsWonCount.values()).reduce((a, b) => a + b, 0);
	const roundsWon = playerList.map((pl) => {
		const value = roundsWonCount.get(pl.id) || 0;
		return {
			player: pl.name,
			value,
			percent: totalRoundsWon > 0 ? value / totalRoundsWon : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	// Rounds by type pie chart
	const totalRounds = totalNormalRounds + totalHochzeitRounds + totalSoloRounds;
	const roundsByType = [
		{
			type: 'Normal',
			value: totalNormalRounds,
			percent: totalRounds > 0 ? totalNormalRounds / totalRounds : 0,
			color: roundTypeColorPalette[0]
		},
		{
			type: 'Hochzeit',
			value: totalHochzeitRounds,
			percent: totalRounds > 0 ? totalHochzeitRounds / totalRounds : 0,
			color: roundTypeColorPalette[1]
		},
		{
			type: 'Solo',
			value: totalSoloRounds,
			percent: totalRounds > 0 ? totalSoloRounds / totalRounds : 0,
			color: roundTypeColorPalette[2]
		}
	];

	// Solo rounds by type pie chart
	const soloRoundsByType = soloTypeOrder
		.map((rType) => {
			const value = soloTypeCounts.get(rType) || 0;
			return {
				type: soloTypeLabels[rType] || rType,
				value,
				percent: totalSoloRounds > 0 ? value / totalSoloRounds : 0,
				color: soloTypeColors[rType]
			};
		})
		.filter((item) => item.value > 0);

	// Round type share by player
	const roundTypeShareByPlayer = playerList.map((pl) => {
		const normal = playerNormalCount.get(pl.id) || 0;
		const hochzeit = playerHochzeitCount.get(pl.id) || 0;
		const solo = playerSoloParticipationCount.get(pl.id) || 0;
		const total = normal + hochzeit + solo;
		return {
			player: pl.name,
			normalShare: total > 0 ? normal / total : 0,
			hochzeitShare: total > 0 ? hochzeit / total : 0,
			soloShare: total > 0 ? solo / total : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	// Win/lost share by type
	const winLostShareByType = playerList.map((pl) => {
		const normalTotalRounds = normalTotal.get(pl.id) || 0;
		const hochzeitTotalRounds = hochzeitTotal.get(pl.id) || 0;
		const soloTotalRounds = soloTotal.get(pl.id) || 0;
		return {
			player: pl.name,
			normalWinShare: normalTotalRounds > 0 ? (normalWins.get(pl.id) || 0) / normalTotalRounds : 0,
			hochzeitWinShare:
				hochzeitTotalRounds > 0 ? (hochzeitWins.get(pl.id) || 0) / hochzeitTotalRounds : 0,
			soloWinShare: soloTotalRounds > 0 ? (soloWins.get(pl.id) || 0) / soloTotalRounds : 0,
			color: playerColorMap.get(pl.id)
		};
	});

	// Average points by game type
	const avgPointsByGameType = playerList.map((pl) => ({
		player: pl.name,
		normal: normalCounts.get(pl.id) ? (normalTotals.get(pl.id) || 0) / normalCounts.get(pl.id)! : 0,
		hochzeit: hochzeitCounts.get(pl.id)
			? (hochzeitTotals.get(pl.id) || 0) / hochzeitCounts.get(pl.id)!
			: 0,
		solo: soloCounts.get(pl.id) ? (soloTotals.get(pl.id) || 0) / soloCounts.get(pl.id)! : 0,
		color: playerColorMap.get(pl.id)
	}));

	// Solo type share by player
	const soloTypeShareByPlayer = playerList.map((pl) => {
		const soloTypeMap = playerSoloTypeCounts.get(pl.id);
		if (!soloTypeMap) return { player: pl.name, color: playerColorMap.get(pl.id) };
		const totalSolos = Array.from(soloTypeMap.values()).reduce((a, b) => a + b, 0);
		const result: Record<string, any> = { player: pl.name, color: playerColorMap.get(pl.id) };
		soloTypeOrder.forEach((rType) => {
			const count = soloTypeMap.get(rType) || 0;
			const label = soloTypeLabels[rType] || '';
			result[label] = totalSolos ? count / totalSolos : 0;
		});
		return result;
	});

	// Solo type win rate by player
	const soloTypeWinRateByPlayer = playerList.map((pl) => {
		const soloTypeCountMap = playerSoloTypeCounts.get(pl.id);
		const soloTypeWinMap = playerSoloTypeWins.get(pl.id);
		if (!soloTypeCountMap || !soloTypeWinMap)
			return { player: pl.name, color: playerColorMap.get(pl.id) };
		const result: Record<string, any> = { player: pl.name, color: playerColorMap.get(pl.id) };
		soloTypeOrder.forEach((rType) => {
			const count = soloTypeCountMap.get(rType) || 0;
			const wins = soloTypeWinMap.get(rType) || 0;
			const label = soloTypeLabels[rType] || '';
			result[label] = count ? wins / count : 0;
		});
		return result;
	});

	// Average points by solo type
	const avgPointsBySoloType = playerList.map((pl) => {
		const result: Record<string, any> = {
			player: pl.name,
			color: playerColorMap.get(pl.id)
		};
		const soloTypeCountMap = playerSoloTypeCounts.get(pl.id);
		const soloTypePointMap = playerSoloTypePoints.get(pl.id);
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

	// Team win rates (Re/Kontra)
	const teamWinRates = playerList.map((pl) => ({
		player: pl.name,
		reRate: reRoundsPlayed.get(pl.id)
			? (reRoundsWon.get(pl.id) || 0) / reRoundsPlayed.get(pl.id)!
			: 0,
		kontraRate: kontraRoundsPlayed.get(pl.id)
			? (kontraRoundsWon.get(pl.id) || 0) / kontraRoundsPlayed.get(pl.id)!
			: 0,
		color: playerColorMap.get(pl.id)
	}));

	// Pair team counts
	const pairTeamCounts = Array.from(pairTeamRoundCounts.entries())
		.map(([key, value]) => ({
			key,
			value,
			color: (() => {
				const firstName = key.split(' & ')[0];
				const pl = playerList.find((p) => p.name === firstName);
				return pl ? playerColorMap.get(pl.id) : palette[0];
			})()
		}))
		.sort((a, b) => b.value - a.value);

	// Series definitions
	const roundTypeSeries = [
		{ key: 'normal', label: 'Normal', color: roundTypeColorPalette[0] },
		{ key: 'hochzeit', label: 'Hochzeit', color: roundTypeColorPalette[1] },
		{ key: 'solo', label: 'Solo', color: roundTypeColorPalette[2] }
	];

	const soloTypeSeries = soloTypeOrder
		.filter((rType) => (soloTypeCounts.get(rType) || 0) > 0)
		.map((rType) => ({
			key: soloTypeLabels[rType] || rType,
			label: soloTypeLabels[rType] || rType,
			color: soloTypeColors[rType]
		}));

	return {
		playerSeries: {
			rows,
			series
		},
		reKontraShare,
		winLostShareByType,
		avgReKontra,
		avgPairs,
		pairTeamCounts,
		bonusGrouped,
		avgEyesGrouped,
		avgEyes,
		callGrouped,
		callSuccessRate,
		roundsWon,
		roundsByType,
		soloRoundsByType,
		roundTypeShareByPlayer,
		soloTypeShareByPlayer,
		soloTypeWinRateByPlayer,
		avgPointsByGameType,
		avgPointsBySoloType,
		teamWinRates,
		soloTypeSeries,
		roundTypeSeries,
		callSeries,
		bonusSeries
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
	gameRepo?: GameRepository;
}): Promise<GameStatistics> {
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
