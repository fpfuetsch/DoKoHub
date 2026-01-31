import { describe, expect, it } from 'vitest';
import { BonusType, CallType, Team, RoundType } from '$lib/domain/enums';
import { calculatePlayerStatistics } from './player';

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
	groupId: string;
	participants: Array<{
		player: { id: string; getTruncatedDisplayName: () => string };
	}>;
	rounds: MockRound[];
	isFinished: () => boolean;
}

function createMockGame(overrides?: Partial<MockGame>): MockGame {
	return {
		id: 'game-1',
		groupId: 'group-1',
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
// CALCULATE PLAYER STATISTICS TESTS
// ============================================================================

describe('calculatePlayerStatistics', () => {
	it('returns empty statistics when no games exist', () => {
		const stats = calculatePlayerStatistics('p1', 'Alice', [], []);

		expect(stats.totalGames).toBe(0);
		expect(stats.totalRounds).toBe(0);
		expect(stats.gamesWon).toBe(0);
		expect(stats.gamesPlayed).toBe(0);
		expect(stats.avgPointsPerGame).toBe(0);
		expect(stats.roundsWon).toEqual([]);
	});

	it('returns empty statistics when player has not participated in any finished games', () => {
		const game = createMockGame({
			id: 'g1',
			participants: [
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Charlie' } }
			]
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.totalGames).toBe(0);
		expect(stats.totalRounds).toBe(0);
		expect(stats.gamesWon).toBe(0);
		expect(stats.gamesPlayed).toBe(0);
	});

	it('returns empty statistics when games are not finished', () => {
		const game = createMockGame({
			isFinished: () => false
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.totalGames).toBe(0);
		expect(stats.totalRounds).toBe(0);
	});

	it('calculates basic game statistics correctly', () => {
		const game = createMockGame({
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

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.totalGames).toBe(1);
		expect(stats.gamesPlayed).toBe(1);
		expect(stats.totalRounds).toBe(2);
		expect(stats.avgPointsPerGame).toBe(5); // (10 + -5) / 1
		expect(stats.gamesWon).toBe(1); // p1 has 5 points, p2 has -5 points
	});

	it('calculates statistics across multiple games', () => {
		const game1 = createMockGame({
			id: 'g1',
			groupId: 'group-1',
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
			groupId: 'group-2',
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

		const stats = calculatePlayerStatistics('p1', 'Alice', [game1 as any, game2 as any], []);

		expect(stats.totalGames).toBe(2);
		expect(stats.gamesPlayed).toBe(2);
		expect(stats.totalRounds).toBe(2); // 1 normal + 1 solo
		expect(stats.avgPointsPerGame).toBe(12.5); // (10 + 15) / 2
		expect(stats.gamesWon).toBe(2); // won both games
	});

	it('counts wins correctly when player loses', () => {
		const game = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 90,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.gamesWon).toBe(0);
		expect(stats.gamesPlayed).toBe(1);
	});

	it('counts ties as wins for both players', () => {
		const game = createMockGame({
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
						{ playerId: 'p1', points: 5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.gamesWon).toBe(1); // Both have max score, so both win
		expect(stats.gamesPlayed).toBe(1);
	});

	it('tracks round wins correctly', () => {
		const game = createMockGame({
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
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 100,
					calculatePoints: () => [
						{ playerId: 'p1', points: -5 },
						{ playerId: 'p2', points: 5 }
					]
				}
			]
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		expect(stats.roundsWon).toHaveLength(1);
		expect(stats.roundsWon[0].value).toBe(1); // Won 1 out of 2 rounds
		expect(stats.roundsWon[0].percent).toBe(1); // 1/1 = 100% (only one player tracked)
	});

	it('filters aggregates to only include player data', () => {
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
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 5 },
						{ playerId: 'p2', points: 5 },
						{ playerId: 'p3', points: -10 }
					]
				}
			]
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		// Should only track p1's stats
		expect(stats.totalGames).toBe(1);
		expect(stats.totalRounds).toBe(1);
		expect(stats.avgPointsPerGame).toBe(5);
	});

	it('handles games with no rounds gracefully', () => {
		const game = createMockGame({
			id: 'g1',
			rounds: []
		});

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		// Game should not be counted if it has no rounds
		expect(stats.totalGames).toBe(0);
		expect(stats.totalRounds).toBe(0);
	});

	it('tracks team statistics (RE/KONTRA)', () => {
		const game = createMockGame({
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

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		// Should have RE/KONTRA share data
		expect(stats.reKontraShare).toBeDefined();
		expect(stats.teamWinRates).toBeDefined();
		expect(stats.avgReKontra).toBeDefined();
	});

	it('tracks bonuses and calls', () => {
		const game = createMockGame({
			id: 'g1',
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [{ bonusType: BonusType.Doko, count: 1 }],
							calls: [{ callType: CallType.RE }]
						},
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

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		// Should have bonus and call data
		expect(stats.bonusGrouped).toBeDefined();
		expect(stats.callGrouped).toBeDefined();
		expect(stats.callSuccessRate).toBeDefined();
	});

	it('provides series data for charts', () => {
		const game = createMockGame({
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

		const stats = calculatePlayerStatistics('p1', 'Alice', [game as any], []);

		// Should have all series data for chart legends
		expect(stats.soloTypeSeries).toBeDefined();
		expect(stats.roundTypeSeries).toBeDefined();
		expect(stats.callSeries).toBeDefined();
		expect(stats.bonusSeries).toBeDefined();
		expect(stats.reKontraSeries).toBeDefined();
		expect(stats.reKontraRateSeries).toBeDefined();
		expect(stats.reKontraAvgSeries).toBeDefined();

		expect(Array.isArray(stats.roundTypeSeries)).toBe(true);
		expect(stats.roundTypeSeries.length).toBeGreaterThan(0);
	});
});
