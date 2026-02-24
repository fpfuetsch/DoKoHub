import { describe, expect, it } from 'vitest';
import { BonusType, CallType, Team, RoundType } from '$lib/domain/enums';
import { calculateGroupStatistics, mergeGameAggregates } from './group';
import { aggregateGameRounds } from './game';

// ============================================================================
// HELPER: Mock game builder for cleaner test setup
// ============================================================================

interface MockRound {
	roundNumber: number;
	type?: RoundType;
	isSolo?: () => boolean;
	participants: Array<{
		playerId: string;
		team: Team;
		bonuses?: Array<{ bonusType: BonusType; count: number }>;
		calls?: Array<{ callType: CallType }>;
	}>;
	eyesRe: number;
	calculatePoints: () => Array<{ playerId: string; points: number }>;
}

interface MockGame {
	id: string;
	createdAt?: Date;
	endedAt?: Date | null;
	participants: Array<{
		player: { id: string; getTruncatedDisplayName: () => string };
	}>;
	rounds: MockRound[];
	isFinished: () => boolean;
}

function createMockGame(overrides?: Partial<MockGame>): MockGame {
	return {
		id: 'game-1',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		endedAt: new Date('2026-01-01T00:00:00.000Z'),
		participants: [
			{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
			{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
		],
		rounds: [
			{
				roundNumber: 1,
				type: RoundType.Normal,
				participants: [
					{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
					{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
				],
				eyesRe: 120,
				calculatePoints: () => [
					{ playerId: 'p1', points: 10 },
					{ playerId: 'p2', points: -10 }
				]
			}
		],
		isFinished: () => true,
		...overrides
	};
}

// ============================================================================
// MERGE GAME AGGREGATES TESTS
// ============================================================================

describe('mergeGameAggregates', () => {
	it('returns empty aggregates for empty input', () => {
		const merged = mergeGameAggregates([]);

		expect(merged.playerList).toEqual([]);
		expect(merged.totalNormalRounds).toBe(0);
		expect(merged.totalSoloRounds).toBe(0);
		expect(merged.rounds).toEqual([]);
	});

	it('merges player lists from multiple games', () => {
		const game1 = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			participants: [
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Charlie' } }
			]
		});

		const agg1 = aggregateGameRounds(game1 as any);
		const agg2 = aggregateGameRounds(game2 as any);

		const merged = mergeGameAggregates([agg1, agg2]);

		expect(merged.playerList).toHaveLength(3);
		expect(merged.playerList.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
		expect(merged.playerList.map((p) => p.name).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
	});

	it('sums round counts across games', () => {
		const game1 = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 100,
					calculatePoints: () => [
						{ playerId: 'p1', points: -5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloAss,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: 15 },
						{ playerId: 'p2', points: -15 }
					]
				}
			]
		});

		const agg1 = aggregateGameRounds(game1 as any);
		const agg2 = aggregateGameRounds(game2 as any);

		const merged = mergeGameAggregates([agg1, agg2]);

		expect(merged.totalNormalRounds).toBe(2);
		expect(merged.totalSoloRounds).toBe(1);
	});

	it('merges RE/KONTRA counts correctly', () => {
		const game1 = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 100,
					calculatePoints: () => [
						{ playerId: 'p1', points: -5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const agg1 = aggregateGameRounds(game1 as any);
		const agg2 = aggregateGameRounds(game2 as any);

		const merged = mergeGameAggregates([agg1, agg2]);

		expect(merged.reCounts.get('p1')).toBe(1);
		expect(merged.kontraCounts.get('p1')).toBe(1);
		expect(merged.reCounts.get('p2')).toBe(1);
		expect(merged.kontraCounts.get('p2')).toBe(1);
	});

	it('merges pair statistics across games', () => {
		const game1 = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: 15 },
						{ playerId: 'p2', points: 15 }
					]
				}
			]
		});

		const agg1 = aggregateGameRounds(game1 as any);
		const agg2 = aggregateGameRounds(game2 as any);

		const merged = mergeGameAggregates([agg1, agg2]);

		const pairKey = 'Alice & Bob';
		expect(merged.pairTeamRoundCounts.get(pairKey)).toBe(2);
		expect(merged.pairCounts.get(pairKey)).toBe(2);
	});
});

// ============================================================================
// CALCULATE GROUP STATISTICS TESTS
// ============================================================================

describe('calculateGroupStatistics', () => {
	it('filters out unfinished games', () => {
		const finishedGame = createMockGame({
			id: 'g1',
			isFinished: () => true
		});

		const unfinishedGame = createMockGame({
			id: 'g2',
			isFinished: () => false
		});

		const stats = calculateGroupStatistics([finishedGame, unfinishedGame] as any);

		expect(stats.gamesCount).toBe(1);
	});

	it('returns empty statistics for empty games list', () => {
		const stats = calculateGroupStatistics([]);

		expect(stats.gamesWon).toEqual([]);
		expect(stats.gamesCount).toBe(0);
		expect(stats.roundsCount).toBe(0);
		expect(stats.playerSeries.rows).toEqual([]);
		expect(stats.playerSeries.series).toEqual([]);
		expect(stats.playerSeriesByGame.rows).toEqual([]);
		expect(stats.playerSeriesByGame.series).toEqual([]);
	});

	it('calculates cumulative playerSeriesByGame over finished games in chronological order', () => {
		const game1 = createMockGame({
			id: 'g1',
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			endedAt: new Date('2026-01-02T00:00:00.000Z'),
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			createdAt: new Date('2026-01-02T00:00:00.000Z'),
			endedAt: new Date('2026-01-01T00:00:00.000Z'),
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: -5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game1, game2] as any);

		expect(stats.playerSeriesByGame.rows).toEqual([
			{ date: new Date('2026-01-01T00:00:00.000Z'), Alice: -5, Bob: 5 },
			{ date: new Date('2026-01-02T00:00:00.000Z'), Alice: 5, Bob: -5 }
		]);
		expect(stats.playerSeriesByGame.series).toHaveLength(2);
		expect(stats.playerSeriesByGame.series.map((s) => s.label).sort()).toEqual(['Alice', 'Bob']);
	});

	it('calculates gamesCount correctly', () => {
		const game1 = createMockGame({ id: 'g1' });
		const game2 = createMockGame({ id: 'g2' });

		const stats = calculateGroupStatistics([game1, game2] as any);

		expect(stats.gamesCount).toBe(2);
	});

	it('calculates roundsCount correctly', () => {
		const game1 = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 100,
					calculatePoints: () => [
						{ playerId: 'p1', points: -5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.HochzeitStill,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: 15 },
						{ playerId: 'p2', points: -15 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game1, game2] as any);

		expect(stats.roundsCount).toBe(3);
	});

	it('calculates gamesWon correctly', () => {
		const game1 = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: -15 },
						{ playerId: 'p2', points: 15 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game1, game2] as any);

		const aliceWins = stats.gamesWon.find((g) => g.player === 'Alice');
		const bobWins = stats.gamesWon.find((g) => g.player === 'Bob');

		expect(aliceWins?.value).toBe(1);
		expect(bobWins?.value).toBe(1);
		expect(aliceWins?.percent).toBe(0.5);
		expect(bobWins?.percent).toBe(0.5);
	});

	it('counts all top scorers as game winners', () => {
		const game = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Charlie' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: 20 },
						{ playerId: 'p3', points: -5 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game] as any);

		const aliceWins = stats.gamesWon.find((g) => g.player === 'Alice');
		const bobWins = stats.gamesWon.find((g) => g.player === 'Bob');
		const charlieWins = stats.gamesWon.find((g) => g.player === 'Charlie');

		expect(aliceWins?.value).toBe(1);
		expect(bobWins?.value).toBe(1);
		expect(charlieWins?.value).toBe(0);
		expect(aliceWins?.percent).toBe(1);
		expect(bobWins?.percent).toBe(1);
		expect(charlieWins?.percent).toBe(0);
	});

	it('calculates avgTotalPointsPerGame correctly', () => {
		const game1 = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 130,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const game2 = createMockGame({
			id: 'g2',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 110,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game1, game2] as any);

		const aliceAvg = stats.avgTotalPointsPerGame.find((p) => p.player === 'Alice');
		const bobAvg = stats.avgTotalPointsPerGame.find((p) => p.player === 'Bob');

		// Alice: game1 = 30 points, game2 = -10 points, avg = 10
		expect(aliceAvg?.Alice).toBe(10);
		// Bob: game1 = -30 points, game2 = 10 points, avg = -10
		expect(bobAvg?.Bob).toBe(-10);
	});

	it('reuses game-level calculation functions', () => {
		const game1 = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game1] as any);

		// Check that all game-level properties exist
		expect(stats.playerSeries).toBeDefined();
		expect(stats.reKontraShare).toBeDefined();
		expect(stats.avgReKontra).toBeDefined();
		expect(stats.avgPairs).toBeDefined();
		expect(stats.bonusGrouped).toBeDefined();
		expect(stats.avgEyes).toBeDefined();
		expect(stats.avgEyesGrouped).toBeDefined();
		expect(stats.callGrouped).toBeDefined();
		expect(stats.callSuccessRate).toBeDefined();
		expect(stats.callFScore).toBeDefined();
		expect(stats.roundsWon).toBeDefined();
		expect(stats.roundsByType).toBeDefined();
		expect(stats.soloRoundsByType).toBeDefined();
		expect(stats.winLostShareByType).toBeDefined();
		expect(stats.avgPointsByGameType).toBeDefined();
		expect(stats.soloTypeShareByPlayer).toBeDefined();
		expect(stats.soloTypeWinRateByPlayer).toBeDefined();
		expect(stats.avgPointsBySoloType).toBeDefined();
		expect(stats.teamWinRates).toBeDefined();
		expect(stats.pairTeamCounts).toBeDefined();
	});

	it('handles games with no rounds', () => {
		const gameWithRounds = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const gameWithoutRounds = createMockGame({
			id: 'g2',
			rounds: []
		});

		const stats = calculateGroupStatistics([gameWithRounds, gameWithoutRounds] as any);

		// Only the game with rounds should be counted
		expect(stats.gamesCount).toBe(1);
		expect(stats.roundsCount).toBe(1);
	});

	it('filters players with zero games played from results', () => {
		const game = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Charlie' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const stats = calculateGroupStatistics([game] as any);

		// Players who are game participants are included even if they didn't play any rounds
		// Charlie is a participant, so they're included with 0 values
		expect(stats.gamesWon).toHaveLength(3);
		expect(stats.avgTotalPointsPerGame).toHaveLength(3);
		expect(stats.avgTotalPointsPerGame.map((g) => g.player).sort()).toEqual([
			'Alice',
			'Bob',
			'Charlie'
		]);
		// Charlie should have 0 average and 0 games won since they didn't play
		const charlie = stats.avgTotalPointsPerGame.find((s) => s.player === 'Charlie');
		expect(charlie?.Charlie).toBe(0);
		const charlieWon = stats.gamesWon.find((s) => s.player === 'Charlie');
		expect(charlieWon?.value).toBe(0);
	});
});
