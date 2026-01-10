import { error, type ServerLoad } from '@sveltejs/kit';
import { Team, BonusType } from '$lib/domain/enums';
import { CallType } from '$lib/domain/enums';
import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load: ServerLoad = async ({ locals, params }) => {
	const user = requireUserOrFail({ locals });
	const gameId = params.game!;
	const groupId = params.group!;

	const gameRepo = new GameRepository(user.id);
	const game = await gameRepo.getById(gameId, groupId);

	if (!game || !game.rounds) {
		throw error(404, 'Spiel nicht gefunden');
	}

	// Prepare player list and color map
	const rounds = Array.from(new Set(game.rounds.map((r) => r.roundNumber))).sort((a, b) => a - b);
	const playerList = game.participants
		.filter((p) => p.player)
		.map((p) => ({
			id: p.player!.id,
			name: p.player!.getTruncatedDisplayName() || p.player!.name || 'Unknown'
		}));

	const palette = ['#ef562f', '#0284c7', '#16a34a', '#eab308'];
	const playerColorMap = new Map<string, string>();
	playerList.forEach((pl, idx) => playerColorMap.set(pl.id, palette[idx % palette.length]));

	// Initialize per-player aggregates
	const playerPointsMap = new Map<string, { round: number; cumulativePoints: number }[]>();
	const reCounts = new Map<string, number>();
	const kontraCounts = new Map<string, number>();
	const winRoundCounts = new Map<string, number>();
	const loseRoundCounts = new Map<string, number>();
	const reTotals = new Map<string, number>();
	const reCountsMap = new Map<string, number>();
	const kontraTotals = new Map<string, number>();
	const kontraCountsMap = new Map<string, number>();
	const eyesTotals = new Map<string, number>();
	const eyesCounts = new Map<string, number>();
	const dokoCounts = new Map<string, number>();
	const fuchsCounts = new Map<string, number>();
	const karlchenCounts = new Map<string, number>();
	const callTypes = [
		CallType.RE,
		CallType.KONTRA,
		CallType.Keine90,
		CallType.Keine60,
		CallType.Keine30,
		CallType.Schwarz
	];
	const callCountsMap: Record<string, Map<string, number>> = {};

	playerList.forEach((pl) => {
		playerPointsMap.set(pl.id, []);
		reCounts.set(pl.id, 0);
		kontraCounts.set(pl.id, 0);
		winRoundCounts.set(pl.id, 0);
		loseRoundCounts.set(pl.id, 0);
		reTotals.set(pl.id, 0);
		reCountsMap.set(pl.id, 0);
		kontraTotals.set(pl.id, 0);
		kontraCountsMap.set(pl.id, 0);
		eyesTotals.set(pl.id, 0);
		eyesCounts.set(pl.id, 0);
		dokoCounts.set(pl.id, 0);
		fuchsCounts.set(pl.id, 0);
		karlchenCounts.set(pl.id, 0);
		const m = new Map<string, number>();
		callTypes.forEach((ct) => m.set(ct, 0));
		callCountsMap[pl.id] = m;
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
	for (const pair of pairs) {
		const key = `${pair.a.name} & ${pair.b.name}`;
		pairTotals.set(key, 0);
		pairCounts.set(key, 0);
	}

	// Single pass over rounds to compute all aggregates
	for (const round of game.rounds) {
		const roundPoints = round.calculatePoints();
		const eyesRe = round.eyesRe ?? 0;

		// Map participant -> team for this round and process participant-level aggregates
		const teamMap = new Map<string, string>();
		for (const participant of round.participants) {
			teamMap.set(participant.playerId, participant.team);

			// re/kontra counts
			if (participant.team === Team.RE) {
				reCounts.set(participant.playerId, (reCounts.get(participant.playerId) || 0) + 1);
			} else if (participant.team === Team.KONTRA) {
				kontraCounts.set(participant.playerId, (kontraCounts.get(participant.playerId) || 0) + 1);
			}

			// bonuses
			(participant.bonuses || []).forEach((b: any) => {
				if (b.bonusType === BonusType.Doko) {
					dokoCounts.set(
						participant.playerId,
						(dokoCounts.get(participant.playerId) || 0) + (b.count || 0)
					);
				} else if (b.bonusType === BonusType.Fuchs) {
					fuchsCounts.set(
						participant.playerId,
						(fuchsCounts.get(participant.playerId) || 0) + (b.count || 0)
					);
				} else if (b.bonusType === BonusType.Karlchen) {
					karlchenCounts.set(
						participant.playerId,
						(karlchenCounts.get(participant.playerId) || 0) + (b.count || 0)
					);
				}
			});

			// calls
			(participant.calls || []).forEach((c: any) => {
				const m = callCountsMap[participant.playerId];
				if (!m) return;
				m.set(c.callType, (m.get(c.callType) || 0) + 1);
			});

			// eyes (team achieved)
			const achievedEyes = participant.team === Team.RE ? eyesRe : 240 - eyesRe;
			eyesTotals.set(
				participant.playerId,
				(eyesTotals.get(participant.playerId) || 0) + achievedEyes
			);
			eyesCounts.set(participant.playerId, (eyesCounts.get(participant.playerId) || 0) + 1);
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

			// win/lose counts
			if (rp.points > 0) {
				winRoundCounts.set(rp.playerId, (winRoundCounts.get(rp.playerId) || 0) + 1);
			} else if (rp.points < 0) {
				loseRoundCounts.set(rp.playerId, (loseRoundCounts.get(rp.playerId) || 0) + 1);
			}

			// avg re/kontra totals
			const team = teamMap.get(rp.playerId);
			if (team === Team.RE) {
				reTotals.set(rp.playerId, (reTotals.get(rp.playerId) || 0) + rp.points);
				reCountsMap.set(rp.playerId, (reCountsMap.get(rp.playerId) || 0) + 1);
			} else if (team === Team.KONTRA) {
				kontraTotals.set(rp.playerId, (kontraTotals.get(rp.playerId) || 0) + rp.points);
				kontraCountsMap.set(rp.playerId, (kontraCountsMap.get(rp.playerId) || 0) + 1);
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
	const rows = rounds.map((roundNum) => {
		const row: Record<string, number | null> = { round: roundNum };
		for (const [playerId, history] of playerPointsMap.entries()) {
			const playerEntry = playerList.find((p) => p.id === playerId);
			const playerName = playerEntry?.name || playerId;
			const pointEntry = history.find((h) => h.round === roundNum);
			row[playerName] = pointEntry ? pointEntry.cumulativePoints : null;
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

	const winLostShare = playerList.map((pl) => {
		const won = winRoundCounts.get(pl.id) || 0;
		const lost = loseRoundCounts.get(pl.id) || 0;
		const total = won + lost;
		return {
			player: pl.name,
			wonShare: total ? won / total : 0,
			lostShare: total ? lost / total : 0,
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

	const avgPairs = Array.from(pairTotals.entries()).map(([key, total]) => ({
		key,
		value: total / (pairCounts.get(key) || 1),
		color: (() => {
			const firstName = key.split(' & ')[0];
			const pl = playerList.find((p) => p.name === firstName);
			return pl ? playerColorMap.get(pl.id) : palette[0];
		})()
	}));

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

	return {
		stats: {
			playerSeries: {
				rows,
				series
			},
			reKontraShare,
			avgPairs,
			bonusGrouped,
			avgEyesGrouped,
			callGrouped,
			avgEyes,
			avgReKontra,
			winLostShare
		}
	};
};
