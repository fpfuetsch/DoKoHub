import type { ServerLoad } from '@sveltejs/kit';
import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load: ServerLoad = async ({ parent, locals, params }) => {
	const user = requireUserOrFail({ locals });
	const gameId = params.game!;
	const groupId = params.group!;

	const gameRepo = new GameRepository(user.id);
	const game = await gameRepo.getById(gameId, groupId);

	if (!game || !game.rounds) {
		return { data: [] };
	}

	// Build a map of cumulative points for each player across rounds
	const playerPointsMap = new Map<string, { round: number; cumulativePoints: number }[]>();

	// Initialize all players with 0 points
	game.participants.forEach((participant) => {
		if (participant.player) {
			playerPointsMap.set(participant.player.id, []);
		}
	});

	// Calculate cumulative points for each round
	let roundNumber = 0;
	for (const round of game.rounds) {
		roundNumber = round.roundNumber;
		const roundPoints = round.calculatePoints();

		// Initialize round points for all players
		if (playerPointsMap.size === 0) {
			roundPoints.forEach((rp) => {
				if (!playerPointsMap.has(rp.playerId)) {
					playerPointsMap.set(rp.playerId, []);
				}
			});
		}

		// Add points for this round
		roundPoints.forEach((rp) => {
			const playerHistory = playerPointsMap.get(rp.playerId) || [];
			const lastCumulative =
				playerHistory.length > 0 ? playerHistory[playerHistory.length - 1].cumulativePoints : 0;

			playerHistory.push({
				round: round.roundNumber,
				cumulativePoints: lastCumulative + rp.points
			});
			playerPointsMap.set(rp.playerId, playerHistory);
		});
	}

	// Transform into multi-series format for the chart
	const data = Array.from(playerPointsMap.entries()).map(([playerId, history]) => {
		const playerEntry = game.participants.find((p) => p.player && p.player.id === playerId);
		const playerName = playerEntry?.player?.displayName || playerEntry?.player?.name || 'Unknown';
		return {
			series: playerName,
			data: history.map((h) => ({
				round: h.round,
				points: h.cumulativePoints
			}))
		};
	});

	return { data };
};
