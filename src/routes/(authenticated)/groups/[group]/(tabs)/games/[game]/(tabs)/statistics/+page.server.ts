import type { ServerLoad } from '@sveltejs/kit';
import { Team } from '$lib/domain/enums';
import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load: ServerLoad = async ({ locals, params }) => {
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
    const avgPerRound: { round: number; value: number }[] = [];
    for (const round of game.rounds) {
        roundNumber = round.roundNumber;
        const roundPoints = round.calculatePoints();

        // compute average points per player for this round
        const avg =
            roundPoints.reduce((sum, r) => sum + r.points, 0) / (roundPoints.length || 1);
        avgPerRound.push({ round: round.roundNumber, value: avg });

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

    // Compute how often each player was in the RE team
    const reCounts = new Map<string, number>();
    playerList.forEach((pl) => reCounts.set(pl.id, 0));
    for (const round of game.rounds) {
        for (const p of round.participants) {
            if (p.team === Team.RE) {
                reCounts.set(p.playerId, (reCounts.get(p.playerId) || 0) + 1);
            }
        }
    }

    const pie = playerList.map((pl) => ({ key: pl.name, value: reCounts.get(pl.id) || 0, color: playerColorMap.get(pl.id) }));

    // Compute win counts per player
    const winRoundCounts = new Map<string, number>();
    playerList.forEach((pl) => winRoundCounts.set(pl.id, 0));
    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        for (const rp of roundPoints) {
            if (rp.points > 0) {
                winRoundCounts.set(rp.playerId, (winRoundCounts.get(rp.playerId) || 0) + 1);
            }
        }
    }

    const winPie = playerList.map((pl) => ({ key: pl.name, value: winRoundCounts.get(pl.id) || 0, color: playerColorMap.get(pl.id) }));

    // Compute average points per player across rounds
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    playerList.forEach((pl) => {
        totals.set(pl.id, 0);
        counts.set(pl.id, 0);
    });

    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        for (const rp of roundPoints) {
            totals.set(rp.playerId, (totals.get(rp.playerId) || 0) + rp.points);
            counts.set(rp.playerId, (counts.get(rp.playerId) || 0) + 1);
        }
    }

    // Compute average points per player when their round was won vs lost
    const winTotals = new Map<string, number>();
    const winCounts = new Map<string, number>();
    const loseTotals = new Map<string, number>();
    const loseCounts = new Map<string, number>();

    playerList.forEach((pl) => {
        winTotals.set(pl.id, 0);
        winCounts.set(pl.id, 0);
        loseTotals.set(pl.id, 0);
        loseCounts.set(pl.id, 0);
    });

    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        for (const rp of roundPoints) {
            if (rp.points > 0) {
                winTotals.set(rp.playerId, (winTotals.get(rp.playerId) || 0) + rp.points);
                winCounts.set(rp.playerId, (winCounts.get(rp.playerId) || 0) + 1);
            } else {
                loseTotals.set(rp.playerId, (loseTotals.get(rp.playerId) || 0) + rp.points);
                loseCounts.set(rp.playerId, (loseCounts.get(rp.playerId) || 0) + 1);
            }
        }
    }

    const avgWinLoss = playerList.map((pl) => ({
        key: pl.name,
        winAvg: winCounts.get(pl.id) ? winTotals.get(pl.id)! / (winCounts.get(pl.id) || 1) : 0,
        loseAvg: loseCounts.get(pl.id) ? loseTotals.get(pl.id)! / (loseCounts.get(pl.id) || 1) : 0,
        color: playerColorMap.get(pl.id)
    }));

    // Compute average points for each unordered pair of players
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

    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        const rpMap = new Map(roundPoints.map((rp) => [rp.playerId, rp.points]));
        for (const pair of pairs) {
            const key = `${pair.a.name} & ${pair.b.name}`;
            const aPoints = rpMap.get(pair.a.id) ?? 0;
            const bPoints = rpMap.get(pair.b.id) ?? 0;
            pairTotals.set(key, (pairTotals.get(key) || 0) + aPoints + bPoints);
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
    }

    const avgPairs = Array.from(pairTotals.entries()).map(([key, total]) => ({
        key,
        value: total / (pairCounts.get(key) || 1),
        color: (() => {
            // choose the color of the first player in the pair for consistency
            const firstName = key.split(' & ')[0];
            const pl = playerList.find((p) => p.name === firstName);
            return pl ? playerColorMap.get(pl.id) : palette[0];
        })()
    }));

    return { chart: { rows, series, pie, winPie, avgPairs, avgWinLoss } };
};
