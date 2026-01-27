import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Team } from '$lib/domain/enums';

const { requireUserOrRedirectToLoginMock, getGroupStatisticsMock, listByGroupMock, gameRepoCtor } =
	vi.hoisted(() => {
		const requireUserOrRedirectToLoginMock = vi.fn();
		const getGroupStatisticsMock = vi.fn();
		const listByGroupMock = vi.fn();
		const gameRepoCtor = vi.fn(function MockGameRepository(this: any) {
			this.listByGroup = listByGroupMock;
		});

		return {
			requireUserOrRedirectToLoginMock,
			getGroupStatisticsMock,
			listByGroupMock,
			gameRepoCtor
		};
	});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock
}));

vi.mock('$lib/server/statistics/group', async (importOriginal: any) => {
	const actual = await importOriginal();
	return {
		...actual,
		getGroupStatistics: getGroupStatisticsMock
	};
});

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepoCtor
}));

import { load } from './+page.server';

describe('statistics page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrRedirectToLoginMock.mockReset();
		getGroupStatisticsMock.mockReset();
		listByGroupMock.mockReset();
		gameRepoCtor.mockClear();
	});

	it('returns finishedGamesCount = 0 when no games in group', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({ ok: true, value: [] });
		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.finishedGamesCount).toBe(0);
		expect(result.statsPromise).toBeDefined();
	});

	it('returns finishedGamesCount = 0 when all games are unfinished', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({
			ok: true,
			value: [
				{ id: 'g1', isFinished: () => false },
				{ id: 'g2', isFinished: () => false }
			]
		});

		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.finishedGamesCount).toBe(0);
	});

	it('counts finished games correctly', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({
			ok: true,
			value: [
				{ id: 'g1', isFinished: () => true },
				{ id: 'g2', isFinished: () => false },
				{ id: 'g3', isFinished: () => true }
			]
		});

		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.finishedGamesCount).toBe(2);
	});

	it('ignores items without isFinished', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({
			ok: true,
			value: [{ id: 'g1', isFinished: () => true }, { id: 'g2' } as any]
		});

		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.finishedGamesCount).toBe(1);
	});

	it('handles null game entries gracefully', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({
			ok: true,
			value: [{ id: 'g1', isFinished: () => true }, null as any]
		});

		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.finishedGamesCount).toBe(1);
	});

	it('returns statsPromise for deferred stats calculation', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({ ok: true, value: [{ id: 'g1', isFinished: () => true }] });

		const mockStats = {
			gamesPlayed: [{ player: 'Alice', games: 1, color: '#ef562f' }],
			gamesWon: []
		};
		getGroupStatisticsMock.mockResolvedValue(mockStats);

		const result: any = await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		expect(result.statsPromise).toBeDefined();
		const stats = await result.statsPromise;
		expect(stats).toEqual(mockStats);
	});

	it('calls getGroupStatistics with correct parameters', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({ ok: true, value: [] });
		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		await load({
			params: { group: 'group-123' },
			locals: {},
			url: new URL('http://localhost/groups/group-123/statistics')
		} as any);

		expect(getGroupStatisticsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				principalId: 'u1',
				groupId: 'group-123'
			})
		);
	});

	it('handles listByGroup failure gracefully', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({ ok: false, status: 500, error: 'Server error' });
		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		const result = (await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any)) as any;

		// Should still return finishedGamesCount = 0 when list fails
		expect(result.finishedGamesCount).toBe(0);
	});

	it('uses GameRepository from parameter if provided in getGroupStatistics', async () => {
		const user = { id: 'u1', name: 'Alice' };
		requireUserOrRedirectToLoginMock.mockReturnValue(user);
		listByGroupMock.mockResolvedValue({ ok: true, value: [] });
		getGroupStatisticsMock.mockResolvedValue({ gamesPlayed: [] });

		await load({
			params: { group: 'g1' },
			locals: {},
			url: new URL('http://localhost/groups/g1/statistics')
		} as any);

		// GameRepository should be instantiated with correct principalId
		expect(gameRepoCtor).toHaveBeenCalledWith('u1');
	});
});

describe('group statistics calculation edge cases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('handles pair team counting for players on same team across multiple rounds', async () => {
		const { calculateGroupStatistics } = await import('$lib/server/statistics/group');

		const games: any[] = [
			{
				id: 'g1',
				isFinished: () => true,
				createdAt: new Date('2026-01-20'),
				participants: [
					{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
					{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
					{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } }
				],
				rounds: [
					{
						roundNumber: 1,
						participants: [
							{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 150,
						calculatePoints: () => [
							{ playerId: 'p1', points: 10 },
							{ playerId: 'p2', points: 10 },
							{ playerId: 'p3', points: -20 }
						]
					},
					{
						roundNumber: 2,
						participants: [
							{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 120,
						calculatePoints: () => [
							{ playerId: 'p1', points: -8 },
							{ playerId: 'p2', points: 8 },
							{ playerId: 'p3', points: 0 }
						]
					},
					{
						roundNumber: 3,
						participants: [
							{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] }
						],
						eyesRe: 100,
						calculatePoints: () => [
							{ playerId: 'p1', points: -5 },
							{ playerId: 'p2', points: -5 },
							{ playerId: 'p3', points: 10 }
						]
					}
				]
			}
		];

		const stats = calculateGroupStatistics(games as any);

		// Alice & Bob paired together: RE in round 1, KONTRA in round 3 = 2 rounds
		// Alice & Bob were NOT on same team in round 2 (Alice KONTRA, Bob RE)
		// Alice & Cara paired together: KONTRA in round 2 = 1 round
		// Bob & Cara paired together: different teams in all rounds = 0 rounds
		const aliceBobPair = stats.pairTeamCounts.find(
			(p) => p.key.includes('Alice') && p.key.includes('Bob')
		);
		expect(aliceBobPair?.value).toBe(2);

		const aliceCaraPair = stats.pairTeamCounts.find(
			(p) => p.key.includes('Alice') && p.key.includes('Cara')
		);
		expect(aliceCaraPair?.value ?? 0).toBe(1);

		const bobCaraPair = stats.pairTeamCounts.find(
			(p) => p.key.includes('Bob') && p.key.includes('Cara')
		);
		expect(bobCaraPair?.value ?? 0).toBe(0);
	});

	it('calculates solo type breakdown correctly', async () => {
		const { calculateGroupStatistics } = await import('$lib/server/statistics/group');
		const { RoundType } = await import('$lib/domain/enums');

		const games: any[] = [
			{
				id: 'g1',
				isFinished: () => true,
				createdAt: new Date('2026-01-20'),
				participants: [
					{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
					{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
					{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
					{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
				],
				rounds: [
					{
						roundNumber: 1,
						type: RoundType.SoloBuben,
						participants: [
							{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 100,
						calculatePoints: () => [
							{ playerId: 'p1', points: -30 },
							{ playerId: 'p2', points: 10 },
							{ playerId: 'p3', points: 10 },
							{ playerId: 'p4', points: 10 }
						]
					},
					{
						roundNumber: 2,
						type: RoundType.SoloBuben,
						participants: [
							{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 95,
						calculatePoints: () => [
							{ playerId: 'p1', points: 30 },
							{ playerId: 'p2', points: -10 },
							{ playerId: 'p3', points: -10 },
							{ playerId: 'p4', points: -10 }
						]
					},
					{
						roundNumber: 3,
						type: RoundType.SoloDamen,
						participants: [
							{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
							{ playerId: 'p2', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p3', team: Team.KONTRA, bonuses: [], calls: [] },
							{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
						],
						eyesRe: 110,
						calculatePoints: () => [
							{ playerId: 'p1', points: -30 },
							{ playerId: 'p2', points: 10 },
							{ playerId: 'p3', points: 10 },
							{ playerId: 'p4', points: 10 }
						]
					}
				]
			}
		];

		const stats = calculateGroupStatistics(games as any);

		// Should have 2 SoloBuben, 1 SoloDamen
		const bubenType = stats.soloRoundsByType.find((s) => s.type === 'Bube');
		const damenType = stats.soloRoundsByType.find((s) => s.type.trim() === 'Dame');
		expect(bubenType?.percent).toBeCloseTo(0.667, 2); // 2/3
		expect(damenType?.percent).toBeCloseTo(0.333, 2); // 1/3
	});

	it('filters out unfinished games from calculations', async () => {
		const { calculateGroupStatistics } = await import('$lib/server/statistics/group');

		const games: any[] = [
			{
				id: 'g1',
				isFinished: () => true,
				createdAt: new Date('2026-01-20'),
				participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
				rounds: [
					{
						roundNumber: 1,
						participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
						eyesRe: 150,
						calculatePoints: () => [{ playerId: 'p1', points: 10 }]
					}
				]
			},
			{
				id: 'g2',
				isFinished: () => false,
				createdAt: new Date('2026-01-21'),
				participants: [{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } }],
				rounds: [
					{
						roundNumber: 1,
						participants: [{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] }],
						eyesRe: 150,
						calculatePoints: () => [{ playerId: 'p1', points: 10 }]
					}
				]
			}
		];

		const stats = calculateGroupStatistics(games as any);

		// Only 1 finished game should be counted
		expect(stats.gamesCount).toBe(1);
	});

	it('returns empty statistics for empty games list', async () => {
		const { calculateGroupStatistics } = await import('$lib/server/statistics/group');

		const games: any[] = [];
		const stats = calculateGroupStatistics(games);

		expect(stats.gamesWon).toEqual([]);
		expect(stats.pairTeamCounts).toEqual([]);
		// soloRoundsByType now filters out solo types with 0 occurrences
		expect(stats.soloRoundsByType).toEqual([]);
	});
});
