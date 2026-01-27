import { describe, expect, it } from 'vitest';
import { BonusType, CallType, Team, RoundType } from '$lib/domain/enums';
import { calculateGameStatistics, aggregateGameRounds } from './game';

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
	participants: Array<{
		player: { id: string; getTruncatedDisplayName: () => string };
	}>;
	rounds: MockRound[];
}

function createMockGame(overrides?: Partial<MockGame>): MockGame {
	return {
		id: 'game-1',
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
		...overrides
	};
}

// ============================================================================
// AGGREGATION TESTS
// ============================================================================

describe('aggregateGameRounds', () => {
	it('aggregates basic player participation', () => {
		const game = createMockGame({
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

		const agg = aggregateGameRounds(game as any);

		expect(agg.reCounts.get('p1')).toBe(1);
		expect(agg.kontraCounts.get('p2')).toBe(1);
		expect(agg.totalNormalRounds).toBe(1);
		expect(agg.totalSoloRounds).toBe(0);
	});

	it('aggregates bonuses correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [
								{ bonusType: BonusType.Doko, count: 2 },
								{ bonusType: BonusType.Fuchs, count: 1 },
								{ bonusType: BonusType.Karlchen, count: 1 }
							],
							calls: []
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		expect(agg.dokoCounts.get('p1')).toBe(2);
		expect(agg.fuchsCounts.get('p1')).toBe(1);
		expect(agg.karlchenCounts.get('p1')).toBe(1);
	});

	it('tracks calls per player', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [],
							calls: [
								{ callType: CallType.RE },
								{ callType: CallType.Keine90 },
								{ callType: CallType.Keine60 }
							]
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		expect(agg.callCountsMap['p1'].get(CallType.RE)).toBe(1);
		expect(agg.callCountsMap['p1'].get(CallType.Keine90)).toBe(1);
		expect(agg.callCountsMap['p1'].get(CallType.Keine60)).toBe(1);
	});

	it('tracks eyes correctly for RE and KONTRA', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 150,
					calculatePoints: () => [
						{ playerId: 'p1', points: 0 },
						{ playerId: 'p2', points: 0 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		// p1 is RE, so gets 150 eyes
		expect(agg.eyesTotals.get('p1')).toBe(150);
		// p2 is KONTRA, so gets 240 - 150 = 90 eyes
		expect(agg.eyesTotals.get('p2')).toBe(90);
	});

	it('distinguishes normal vs solo rounds', () => {
		const game = createMockGame({
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
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		expect(agg.totalNormalRounds).toBe(1);
		expect(agg.totalSoloRounds).toBe(1);
		// p1 participates in both round types
		expect(agg.normalTotal.get('p1')).toBe(1);
		expect(agg.soloTotal.get('p1')).toBe(1);
	});

	it('tracks solo types only for RE player', () => {
		const game = createMockGame({
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Charlie' } }
			],
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -5 },
						{ playerId: 'p3', points: -5 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		// Only p1 (RE) gets the solo type tracked
		const p1SoloMap = agg.playerSoloTypeCounts.get('p1');
		expect(p1SoloMap?.get(RoundType.SoloBuben)).toBe(1);

		// p2 and p3 (KONTRA) don't get solo type tracked
		const p2SoloMap = agg.playerSoloTypeCounts.get('p2');
		expect(p2SoloMap?.get(RoundType.SoloBuben)).toBe(0);
	});

	it('tracks call success correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [],
							calls: [{ callType: CallType.RE }]
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		// p1 called RE and won
		expect(agg.callCountsMap['p1'].get(CallType.RE)).toBe(1);
		expect(agg.callWinsMap['p1'].get(CallType.RE)).toBe(1);
	});

	it('tracks wins per round type', () => {
		const game = createMockGame({
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
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		expect(agg.normalWins.get('p1')).toBe(1);
		expect(agg.soloWins.get('p1')).toBe(1);
		expect(agg.normalWins.get('p2')).toBe(0);
		expect(agg.soloWins.get('p2')).toBe(0);
	});

	it('tracks pair team counts', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const agg = aggregateGameRounds(game as any);

		expect(agg.pairTeamRoundCounts.get('Alice & Bob')).toBe(1);
	});
});

// ============================================================================
// CALCULATION FUNCTION TESTS
// ============================================================================

describe('calculatePlayerSeries', () => {
	it('calculates cumulative points correctly', () => {
		const game = createMockGame({
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
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -20 },
						{ playerId: 'p2', points: 20 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.playerSeries.rows).toHaveLength(2);
		expect(stats.playerSeries.rows[0]).toEqual({ round: 1, Alice: 10, Bob: -10 });
		expect(stats.playerSeries.rows[1]).toEqual({ round: 2, Alice: -10, Bob: 10 });
	});

	it('handles missing participants in round (5-player game)', () => {
		const game = createMockGame({
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
						// p3 is dealer and doesn't participate
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
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] }
						// p1 is dealer and doesn't participate
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p2', points: 10 },
						{ playerId: 'p3', points: -10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// Round 1: p1 gets 10, p2 gets -10, p3 not participating gets 0
		expect(stats.playerSeries.rows[0].Alice).toBe(10);
		expect(stats.playerSeries.rows[0].Bob).toBe(-10);
		expect(stats.playerSeries.rows[0].Charlie).toBe(0);

		// Round 2: p1 carries forward 10, p2 gets 10 more (total 0), p3 gets -10 (total -10)
		expect(stats.playerSeries.rows[1].Alice).toBe(10);
		expect(stats.playerSeries.rows[1].Bob).toBe(0);
		expect(stats.playerSeries.rows[1].Charlie).toBe(-10);
	});
});

describe('calculateReKontraShare', () => {
	it('calculates RE vs KONTRA participation share', () => {
		const game = createMockGame({
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
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.reKontraShare).toEqual([
			{ player: 'Alice', reShare: 0.5, kontraShare: 0.5, color: expect.any(String) },
			{ player: 'Bob', reShare: 0.5, kontraShare: 0.5, color: expect.any(String) }
		]);
	});
});

describe('calculateAvgReKontra', () => {
	it('calculates average points when playing RE vs KONTRA', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.avgReKontra).toEqual([
			{ key: 'Alice', reAvg: 20, kontraAvg: 10, color: expect.any(String) },
			{ key: 'Bob', reAvg: -10, kontraAvg: -20, color: expect.any(String) }
		]);
	});
});

describe('calculateBonusGrouped', () => {
	it('aggregates bonuses correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [
								{ bonusType: BonusType.Doko, count: 2 },
								{ bonusType: BonusType.Fuchs, count: 1 },
								{ bonusType: BonusType.Karlchen, count: 1 }
							],
							calls: []
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.bonusGrouped).toEqual([
			{ player: 'Alice', doko: 2, fuchs: 1, karlchen: 1, color: expect.any(String) },
			{ player: 'Bob', doko: 0, fuchs: 0, karlchen: 0, color: expect.any(String) }
		]);
	});
});

describe('calculateAvgEyes', () => {
	it('calculates average eyes correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 150,
					calculatePoints: () => [
						{ playerId: 'p1', points: 0 },
						{ playerId: 'p2', points: 0 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 90,
					calculatePoints: () => [
						{ playerId: 'p1', points: 0 },
						{ playerId: 'p2', points: 0 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// p1: RE in round 1 gets 150, KONTRA in round 2 gets (240 - 90) = 150 -> avg = 150
		// p2: KONTRA in round 1 gets (240 - 150) = 90, RE in round 2 gets 90 -> avg = 90
		expect(stats.avgEyes).toEqual([
			{ player: 'Alice', avgEyes: 150, color: expect.any(String) },
			{ player: 'Bob', avgEyes: 90, color: expect.any(String) }
		]);
	});
});

describe('calculateCallGrouped', () => {
	it('aggregates calls correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [],
							calls: [
								{ callType: CallType.RE },
								{ callType: CallType.Keine90 },
								{ callType: CallType.Keine60 }
							]
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.callGrouped).toEqual([
			{
				player: 'Alice',
				RE: 1,
				KONTRA: 0,
				Keine90: 1,
				Keine60: 1,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Bob',
				RE: 0,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			}
		]);
	});
});

describe('calculateCallSuccessRate', () => {
	it('calculates call success rate correctly', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [],
							calls: [{ callType: CallType.RE }]
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [],
							calls: [{ callType: CallType.RE }]
						},
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// p1 called RE twice: won round 1, lost round 2 -> 50% success
		const p1CallRate = stats.callSuccessRate.find((c) => c.player === 'Alice');
		expect(p1CallRate?.RE).toBe(0.5);
	});
});

describe('calculateRoundsWon', () => {
	it('calculates rounds won with percentage', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
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
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		expect(stats.roundsWon).toEqual([
			{ player: 'Alice', value: 1, percent: 0.5, color: expect.any(String) },
			{ player: 'Bob', value: 1, percent: 0.5, color: expect.any(String) }
		]);
	});
});

describe('calculateRoundsByType', () => {
	it('calculates distribution of normal vs solo rounds', () => {
		const game = createMockGame({
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
					type: RoundType.SoloBuben,
					isSolo: () => true,
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

		const stats = calculateGameStatistics(game as any);

		expect(stats.roundsByType).toEqual([
			{ type: 'Normal', value: 1, percent: 0.5, color: expect.any(String) },
			{ type: 'Solo', value: 1, percent: 0.5, color: expect.any(String) }
		]);
	});
});

describe('calculateSoloRoundsByType', () => {
	it('calculates distribution of solo types', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloBuben,
					isSolo: () => true,
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
					type: RoundType.SoloDamen,
					isSolo: () => true,
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

		const stats = calculateGameStatistics(game as any);

		expect(stats.soloRoundsByType).toHaveLength(2);
		expect(stats.soloRoundsByType[0].type).toBe('Bube');
		expect(stats.soloRoundsByType[0].value).toBe(1);
		expect(stats.soloRoundsByType[1].type).toBe('Dame');
		expect(stats.soloRoundsByType[1].value).toBe(1);
	});
});

describe('calculateWinLostShareByType', () => {
	it('calculates win/loss share by round type', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// p1: won normal (1/1 = 100%), lost solo (0/1 = 0%)
		// p2: lost normal (0/1 = 0%), won solo (1/1 = 100%)
		expect(stats.winLostShareByType).toEqual([
			{ player: 'Alice', normalWinShare: 1, soloWinShare: 0, color: expect.any(String) },
			{ player: 'Bob', normalWinShare: 0, soloWinShare: 1, color: expect.any(String) }
		]);
	});
});

describe('calculateAvgPointsByGameType', () => {
	it('calculates average points in normal vs solo rounds', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 30 },
						{ playerId: 'p2', points: -30 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// p1: normal avg = 20, solo avg = 30
		expect(stats.avgPointsByGameType).toEqual([
			{ player: 'Alice', normal: 20, solo: 30, color: expect.any(String) },
			{ player: 'Bob', normal: -20, solo: -30, color: expect.any(String) }
		]);
	});
});

describe('calculateSoloTypeShareByPlayer', () => {
	it('calculates solo type distribution per player (only RE)', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloBuben,
					isSolo: () => true,
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
					type: RoundType.SoloDamen,
					isSolo: () => true,
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

		const stats = calculateGameStatistics(game as any);

		const p1Share = stats.soloTypeShareByPlayer.find((s) => s.player === 'Alice');
		expect(p1Share?.['Bube']).toBe(0.5);
		expect(p1Share?.['Dame']).toBe(0.5);

		// p2 is KONTRA, so has no solo type data (all values are 0, not undefined)
		const p2Share = stats.soloTypeShareByPlayer.find((s) => s.player === 'Bob');
		expect(p2Share?.['Bube']).toBe(0);
		expect(p2Share?.['Dame']).toBe(0);
	});
});

describe('calculateSoloTypeWinRateByPlayer', () => {
	it('calculates win rates per solo type per player (only RE)', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: -10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		const p1WinRate = stats.soloTypeWinRateByPlayer.find((w) => w.player === 'Alice');
		expect(p1WinRate?.['Bube']).toBe(0.5); // 1 win out of 2 SoloBuben
	});
});

describe('calculateAvgPointsBySoloType', () => {
	it('calculates average points by solo type per player (only RE)', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.SoloBuben,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -20 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.SoloDamen,
					isSolo: () => true,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: 30 },
						{ playerId: 'p2', points: -30 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		const p1Avg = stats.avgPointsBySoloType.find((a) => a.player === 'Alice');
		expect(p1Avg?.['Bube']).toBe(20);
		expect(p1Avg?.['Dame']).toBe(30);
	});
});

describe('calculateTeamWinRates', () => {
	it('calculates team win rates for RE vs KONTRA', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 240,
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
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// p1: RE in round 1 (win), KONTRA in round 2 (loss) -> RE: 100%, KONTRA: 0%
		// p2: KONTRA in round 1 (loss), RE in round 2 (win) -> KONTRA: 0%, RE: 100%
		const p1Rates = stats.teamWinRates.find((r) => r.player === 'Alice');
		expect(p1Rates?.reRate).toBe(1);
		expect(p1Rates?.kontraRate).toBe(0);

		const p2Rates = stats.teamWinRates.find((r) => r.player === 'Bob');
		expect(p2Rates?.reRate).toBe(1);
		expect(p2Rates?.kontraRate).toBe(0);
	});
});

describe('calculatePairTeamCounts', () => {
	it('calculates rounds played together as team', () => {
		const game = createMockGame({
			rounds: [
				{
					roundNumber: 1,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: 10 }
					]
				},
				{
					roundNumber: 2,
					type: RoundType.Normal,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -10 },
						{ playerId: 'p2', points: 10 }
					]
				}
			]
		});

		const stats = calculateGameStatistics(game as any);

		// Pair played together only in round 1
		expect(stats.pairTeamCounts).toEqual([
			{ key: 'Alice & Bob', value: 1, color: expect.any(String) }
		]);
	});
});
