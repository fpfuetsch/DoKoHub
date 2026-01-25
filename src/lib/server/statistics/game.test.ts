import { describe, expect, it, vi } from 'vitest';
import { BonusType, CallType, Team } from '$lib/domain/enums';
import { calculateGameStatistics, getGameStatistics } from './game';

describe('calculateGameStatistics', () => {
	it('calculates basic stats for single round game', () => {
		const game = {
			id: 'game-1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
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
		};

		const stats = calculateGameStatistics(game as any);

		expect(stats.playerSeries.rows).toEqual([{ round: 1, Alice: 10, Bob: -10 }]);
		expect(stats.playerSeries.series).toHaveLength(2);
		expect(stats.reKontraShare).toEqual([
			{ player: 'Alice', reShare: 1, kontraShare: 0, color: expect.any(String) },
			{ player: 'Bob', reShare: 0, kontraShare: 1, color: expect.any(String) }
		]);
	});

	it('handles bonuses correctly', () => {
		const game = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
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
						}
					],
					eyesRe: 240,
					calculatePoints: () => [{ playerId: 'p1', points: 10 }]
				}
			]
		};

		const stats = calculateGameStatistics(game as any);

		expect(stats.bonusGrouped).toEqual([
			{ player: 'Alice', doko: 2, fuchs: 1, karlchen: 1, color: expect.any(String) }
		]);
	});

	it('aggregates calls correctly', () => {
		const game = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
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
						}
					],
					eyesRe: 240,
					calculatePoints: () => [{ playerId: 'p1', points: 10 }]
				}
			]
		};

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
			}
		]);
	});

	it('calculates average Re/Kontra correctly', () => {
		const game = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
					participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
					eyesRe: 240,
					calculatePoints: () => [{ playerId: 'p1', points: 20 }]
				},
				{
					roundNumber: 2,
					participants: [{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] }],
					eyesRe: 120,
					calculatePoints: () => [{ playerId: 'p1', points: 10 }]
				}
			]
		};

		const stats = calculateGameStatistics(game as any);

		expect(stats.avgReKontra).toEqual([
			{ key: 'Alice', reAvg: 20, kontraAvg: 10, color: expect.any(String) }
		]);
	});

	it('calculates pair averages correctly', () => {
		const game = {
			id: 'game-1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } }
			],
			rounds: [
				{
					roundNumber: 1,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 240,
					calculatePoints: () => [
						{ playerId: 'p1', points: 30 },
						{ playerId: 'p2', points: 30 }
					]
				},
				{
					roundNumber: 2,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 120,
					calculatePoints: () => [
						{ playerId: 'p1', points: -20 },
						{ playerId: 'p2', points: -20 }
					]
				}
			]
		};

		const stats = calculateGameStatistics(game as any);

		expect(stats.avgPairs).toEqual([
			{ key: 'Alice & Bob', value: 10, color: expect.any(String) } // Round 1: (30+30)/2=30, Round 2: (-20-20)/2=-20, avg=(30-20)/2=5, total=(30+30-20-20)/2=10
		]);
	});

	it('calculates average eyes correctly', () => {
		const game = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
					participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
					eyesRe: 150,
					calculatePoints: () => [{ playerId: 'p1', points: 0 }]
				},
				{
					roundNumber: 2,
					participants: [{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] }],
					eyesRe: 90,
					calculatePoints: () => [{ playerId: 'p1', points: 0 }]
				}
			]
		};

		const stats = calculateGameStatistics(game as any);

		// Round 1: Alice in RE team, so eyes = 150
		// Round 2: Alice in KONTRA team, so eyes = 240 - 90 = 150
		// Average = (150 + 150) / 2 = 150
		expect(stats.avgEyes).toEqual([{ player: 'Alice', avgEyes: 150, color: expect.any(String) }]);
	});

	it('handles 5-player games with dealer (missing rounds)', () => {
		const game = {
			id: 'game-1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
				{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } },
				{ player: { id: 'p5', getTruncatedDisplayName: () => 'Eve' } }
			],
			rounds: [
				{
					roundNumber: 1,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						// p5 (Eve) doesn't participate - is dealer
					],
					eyesRe: 200,
					calculatePoints: () => [
						{ playerId: 'p1', points: 10 },
						{ playerId: 'p2', points: 10 },
						{ playerId: 'p3', points: -10 },
						{ playerId: 'p4', points: -10 }
					]
				},
				{
					roundNumber: 2,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
						{ playerId: 'p5', team: Team.RE, bonuses: [], calls: [] }
						// p4 (Dave) doesn't participate - is dealer
					],
					eyesRe: 150,
					calculatePoints: () => [
						{ playerId: 'p1', points: 5 },
						{ playerId: 'p2', points: -5 },
						{ playerId: 'p3', points: -5 },
						{ playerId: 'p5', points: 5 }
					]
				}
			]
		};

		const stats = calculateGameStatistics(game as any);

		// Alice: participated in both rounds: 10, 15
		// Bob: participated in both rounds: 10, 5
		// Cara: participated in both rounds: -10, -15
		// Dave: participated in round 1, skipped round 2, carries -10 forward
		// Eve: skipped round 1 (carries 0), participated in round 2: 5
		expect(stats.playerSeries.rows).toEqual([
			{ round: 1, Alice: 10, Bob: 10, Cara: -10, Dave: -10, Eve: 0 },
			{ round: 2, Alice: 15, Bob: 5, Cara: -15, Dave: -10, Eve: 5 }
		]);

		// Verify all 5 players are in the series
		expect(stats.playerSeries.series).toHaveLength(5);
	});
});

describe('getGameStatistics', () => {
	it('throws when game not found', async () => {
		const mockGameRepo = {
			getById: vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				error: 'Game not found'
			})
		};

		const promise = getGameStatistics({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1',
			gameRepo: mockGameRepo as any
		});

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Game not found' }
		});
	});

	it('throws when game has no rounds', async () => {
		const mockGameRepo = {
			getById: vi.fn().mockResolvedValue({
				ok: true,
				value: { id: 'game-1', participants: [], rounds: null }
			})
		};

		const promise = getGameStatistics({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1',
			gameRepo: mockGameRepo as any
		});

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Spiel nicht gefunden.' }
		});
	});

	it('calls getById with correct parameters', async () => {
		const mockGame = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
					participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
					eyesRe: 240,
					calculatePoints: () => [{ playerId: 'p1', points: 10 }]
				}
			]
		};

		const mockGameRepo = {
			getById: vi.fn().mockResolvedValue({
				ok: true,
				value: mockGame
			})
		};

		await getGameStatistics({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1',
			gameRepo: mockGameRepo as any
		});

		expect(mockGameRepo.getById).toHaveBeenCalledWith('game-1', 'group-1');
	});

	it('returns calculated statistics from pure function', async () => {
		const mockGame = {
			id: 'game-1',
			participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
			rounds: [
				{
					roundNumber: 1,
					participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
					eyesRe: 240,
					calculatePoints: () => [{ playerId: 'p1', points: 10 }]
				}
			]
		};

		const mockGameRepo = {
			getById: vi.fn().mockResolvedValue({
				ok: true,
				value: mockGame
			})
		};

		const stats = await getGameStatistics({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1',
			gameRepo: mockGameRepo as any
		});

		expect(stats.playerSeries.rows).toEqual([{ round: 1, Alice: 10 }]);
		expect(stats.playerSeries.series).toHaveLength(1);
	});
});
