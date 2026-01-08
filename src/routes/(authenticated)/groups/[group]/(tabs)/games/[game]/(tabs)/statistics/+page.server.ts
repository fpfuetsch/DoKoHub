import { error, type ServerLoad } from '@sveltejs/kit';
import { Team, BonusType } from '$lib/domain/enums';
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

    // Build a map of cumulative points for each player across rounds
    const playerPointsMap = new Map<string, { round: number; cumulativePoints: number }[]>();

    // Initialize all players with 0 points
    game.participants.forEach((participant) => {
        if (participant.player) {
            playerPointsMap.set(participant.player.id, []);
        }
    });

    // Calculate cumulative points for each round
    for (const round of game.rounds) {
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
        .map((p) => ({ id: p.player!.id, name: p.player!.getTruncatedDisplayName() || p.player!.name || 'Unknown' }));

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

    // Compute how often each player was in the RE or KONTRA team
    const reCounts = new Map<string, number>();
    const kontraCounts = new Map<string, number>();
    playerList.forEach((pl) => {
        reCounts.set(pl.id, 0);
        kontraCounts.set(pl.id, 0);
    });
    for (const round of game.rounds) {
        for (const p of round.participants) {
            if (p.team === Team.RE) {
                reCounts.set(p.playerId, (reCounts.get(p.playerId) || 0) + 1);
            } else if (p.team === Team.KONTRA) {
                kontraCounts.set(p.playerId, (kontraCounts.get(p.playerId) || 0) + 1);
            }
        }
    }

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


    // Compute loss counts per player (points < 0)
    const loseRoundCounts = new Map<string, number>();
    playerList.forEach((pl) => loseRoundCounts.set(pl.id, 0));
    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        for (const rp of roundPoints) {
            if (rp.points < 0) {
                loseRoundCounts.set(rp.playerId, (loseRoundCounts.get(rp.playerId) || 0) + 1);
            }
        }
    }

    // Grouped bar data: won vs lost per player (as shares)
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

    // (average-per-player totals removed — not used)

    // Compute average points per player when they played as RE vs KONTRA
    const reTotals = new Map<string, number>();
    const reCountsMap = new Map<string, number>();
    const kontraTotals = new Map<string, number>();
    const kontraCountsMap = new Map<string, number>();

    playerList.forEach((pl) => {
        reTotals.set(pl.id, 0);
        reCountsMap.set(pl.id, 0);
        kontraTotals.set(pl.id, 0);
        kontraCountsMap.set(pl.id, 0);
    });

    for (const round of game.rounds) {
        const roundPoints = round.calculatePoints();
        // map participant playerId -> team for this round
        const teamMap = new Map<string, string>();
        for (const p of round.participants) {
            teamMap.set(p.playerId, p.team);
        }
        for (const rp of roundPoints) {
            const team = teamMap.get(rp.playerId);
            if (team === Team.RE) {
                reTotals.set(rp.playerId, (reTotals.get(rp.playerId) || 0) + rp.points);
                reCountsMap.set(rp.playerId, (reCountsMap.get(rp.playerId) || 0) + 1);
            } else if (team === Team.KONTRA) {
                kontraTotals.set(rp.playerId, (kontraTotals.get(rp.playerId) || 0) + rp.points);
                kontraCountsMap.set(rp.playerId, (kontraCountsMap.get(rp.playerId) || 0) + 1);
            }
        }
    }

    const avgReKontra = playerList.map((pl) => ({
        key: pl.name,
        reAvg: reCountsMap.get(pl.id) ? reTotals.get(pl.id)! / (reCountsMap.get(pl.id) || 1) : 0,
        kontraAvg: kontraCountsMap.get(pl.id) ? kontraTotals.get(pl.id)! / (kontraCountsMap.get(pl.id) || 1) : 0,
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

    // Compute bonus counts per player (Doko, Fuchs, Karlchen)
    const dokoCounts = new Map<string, number>();
    const fuchsCounts = new Map<string, number>();
    const karlchenCounts = new Map<string, number>();

    playerList.forEach((pl) => {
        dokoCounts.set(pl.id, 0);
        fuchsCounts.set(pl.id, 0);
        karlchenCounts.set(pl.id, 0);
    });

    for (const round of game.rounds) {
        for (const participant of round.participants) {
            (participant.bonuses || []).forEach((b: any) => {
                if (b.bonusType === BonusType.Doko) {
                    dokoCounts.set(participant.playerId, (dokoCounts.get(participant.playerId) || 0) + (b.count || 0));
                } else if (b.bonusType === BonusType.Fuchs) {
                    fuchsCounts.set(participant.playerId, (fuchsCounts.get(participant.playerId) || 0) + (b.count || 0));
                } else if (b.bonusType === BonusType.Karlchen) {
                    karlchenCounts.set(participant.playerId, (karlchenCounts.get(participant.playerId) || 0) + (b.count || 0));
                }
            });
        }
    }

    const bonusGrouped = playerList.map((pl) => ({
        player: pl.name,
        doko: dokoCounts.get(pl.id) || 0,
        fuchs: fuchsCounts.get(pl.id) || 0,
        karlchen: karlchenCounts.get(pl.id) || 0,
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
            avgReKontra,
            winLostShare
        }
    };
};
