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

	// Build rows per round where each row has { round, [playerName]: points }
	const rounds = Array.from(
		new Set(game.rounds.map((r) => r.roundNumber))
	).sort((a, b) => a - b);

	const playerList = game.participants
		.filter((p) => p.player)
		.map((p) => ({ id: p.player!.id, name: p.player!.displayName || p.player!.name || 'Unknown' }));

	// Prepare a palette and map players to colors
	const palette = ['#ef562f', '#0284c7', '#16a34a', '#eab308'];
	const playerColorMap = new Map<string, string>();
	playerList.forEach((pl, idx) => playerColorMap.set(pl.id, palette[idx % palette.length]));

	// Build rows
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
	const series = playerList.map((pl) => ({ key: pl.name, label: pl.name, color: playerColorMap.get(pl.id) }));

	return { chart: { rows, series } };
};
