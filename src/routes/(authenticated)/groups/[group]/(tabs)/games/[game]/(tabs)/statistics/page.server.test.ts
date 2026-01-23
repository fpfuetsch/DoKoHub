import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BonusType, CallType, Team } from '$lib/domain/enums';

const { requireUserOrRedirectToLoginMock, getByIdMock, gameRepositoryCtor } = vi.hoisted(() => {
	const requireUserOrRedirectToLoginMock = vi.fn();
	const getByIdMock = vi.fn();

	const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
		this.getById = getByIdMock;
	});

	return { requireUserOrRedirectToLoginMock, getByIdMock, gameRepositoryCtor };
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

import { load } from './+page.server';

describe('statistics page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrRedirectToLoginMock.mockReset();
		getByIdMock.mockReset();
		gameRepositoryCtor.mockClear();
	});

	it('redirects unauthenticated users to login', async () => {
		requireUserOrRedirectToLoginMock.mockImplementation(() => {
			throw Object.assign(new Error('redirect'), {
				status: 302,
				location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames%2Fgame-1%2Fstatistics'
			});
		});

		const promise = load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames%2Fgame-1%2Fstatistics'
		});
	});

	it('throws when game lookup fails', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });

		const promise = load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Game not found' }
		});
	});

	it('throws when game has no rounds', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1', participants: [], rounds: null }
		});

		const promise = load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 404 });
	});

	it('returns statsPromise with calculated statistics', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });

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

		getByIdMock.mockResolvedValue({ ok: true, value: game });

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(result.statsPromise).toBeInstanceOf(Promise);

		const stats = await result.statsPromise;

		expect(stats.playerSeries.rows).toEqual([{ round: 1, Alice: 10, Bob: -10 }]);
		expect(stats.playerSeries.series).toHaveLength(2);
		expect(stats.winLostShare).toEqual([
			{ player: 'Alice', wonShare: 1, lostShare: 0, color: expect.any(String) },
			{ player: 'Bob', wonShare: 0, lostShare: 1, color: expect.any(String) }
		]);
		expect(stats.reKontraShare).toEqual([
			{ player: 'Alice', reShare: 1, kontraShare: 0, color: expect.any(String) },
			{ player: 'Bob', reShare: 0, kontraShare: 1, color: expect.any(String) }
		]);
	});

	it('computes extended stats for multi-round game', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });

		const game = {
			id: 'game-1',
			participants: [
				{ player: { id: 'p1', getTruncatedDisplayName: () => 'Alice' } },
				{ player: { id: 'p2', getTruncatedDisplayName: () => 'Bob' } },
				{ player: { id: 'p3', getTruncatedDisplayName: () => 'Cara' } },
				{ player: { id: 'p4', getTruncatedDisplayName: () => 'Dave' } }
			],
			rounds: [
				{
					roundNumber: 1,
					participants: [
						{
							playerId: 'p1',
							team: Team.RE,
							bonuses: [{ bonusType: BonusType.Doko, count: 1 }],
							calls: [{ callType: CallType.RE }]
						},
						{
							playerId: 'p2',
							team: Team.KONTRA,
							bonuses: [{ bonusType: BonusType.Fuchs, count: 2 }],
							calls: [{ callType: CallType.Keine90 }]
						},
						{ playerId: 'p3', team: Team.RE, bonuses: [], calls: [] },
						{
							playerId: 'p4',
							team: Team.KONTRA,
							bonuses: [{ bonusType: BonusType.Fuchs, count: 1 }],
							calls: [{ callType: CallType.KONTRA }]
						}
					],
					eyesRe: 150,
					calculatePoints: () => [
						{ playerId: 'p1', points: 20 },
						{ playerId: 'p2', points: -10 },
						{ playerId: 'p3', points: -5 },
						{ playerId: 'p4', points: -5 }
					]
				},
				{
					roundNumber: 2,
					participants: [
						{ playerId: 'p1', team: Team.KONTRA, bonuses: [], calls: [] },
						{
							playerId: 'p2',
							team: Team.RE,
							bonuses: [{ bonusType: BonusType.Karlchen, count: 1 }],
							calls: [{ callType: CallType.RE }]
						},
						{
							playerId: 'p3',
							team: Team.KONTRA,
							bonuses: [],
							calls: [{ callType: CallType.KONTRA }]
						},
						{ playerId: 'p4', team: Team.RE, bonuses: [], calls: [] }
					],
					eyesRe: 80,
					calculatePoints: () => [
						{ playerId: 'p1', points: 5 },
						{ playerId: 'p2', points: -10 },
						{ playerId: 'p3', points: 5 },
						{ playerId: 'p4', points: 0 }
					]
				},
				{
					roundNumber: 3,
					participants: [
						{ playerId: 'p1', team: Team.RE, bonuses: [], calls: [] },
						{ playerId: 'p2', team: Team.RE, bonuses: [], calls: [] },
						{
							playerId: 'p3',
							team: Team.KONTRA,
							bonuses: [],
							calls: [{ callType: CallType.Keine60 }]
						},
						{ playerId: 'p4', team: Team.KONTRA, bonuses: [], calls: [] }
					],
					eyesRe: 180,
					calculatePoints: () => [
						{ playerId: 'p1', points: 12 },
						{ playerId: 'p2', points: 12 },
						{ playerId: 'p3', points: -24 },
						{ playerId: 'p4', points: 0 }
					]
				}
			]
		};

		getByIdMock.mockResolvedValue({ ok: true, value: game });

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		const stats = await result.statsPromise;

		expect(stats.playerSeries.rows).toEqual([
			{ round: 1, Alice: 20, Bob: -10, Cara: -5, Dave: -5 },
			{ round: 2, Alice: 25, Bob: -20, Cara: 0, Dave: -5 },
			{ round: 3, Alice: 37, Bob: -8, Cara: -24, Dave: -5 }
		]);

		expect(stats.bonusGrouped).toEqual([
			{ player: 'Alice', doko: 1, fuchs: 0, karlchen: 0, color: expect.any(String) },
			{ player: 'Bob', doko: 0, fuchs: 2, karlchen: 1, color: expect.any(String) },
			{ player: 'Cara', doko: 0, fuchs: 0, karlchen: 0, color: expect.any(String) },
			{ player: 'Dave', doko: 0, fuchs: 1, karlchen: 0, color: expect.any(String) }
		]);

		expect(stats.callGrouped).toEqual([
			{
				player: 'Alice',
				RE: 1,
				KONTRA: 0,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Bob',
				RE: 1,
				KONTRA: 0,
				Keine90: 1,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Cara',
				RE: 0,
				KONTRA: 1,
				Keine90: 0,
				Keine60: 1,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			},
			{
				player: 'Dave',
				RE: 0,
				KONTRA: 1,
				Keine90: 0,
				Keine60: 0,
				Keine30: 0,
				Schwarz: 0,
				color: expect.any(String)
			}
		]);

		expect(stats.avgReKontra).toEqual([
			{ key: 'Alice', reAvg: 16, kontraAvg: 5, color: expect.any(String) },
			{ key: 'Bob', reAvg: 1, kontraAvg: -10, color: expect.any(String) },
			{ key: 'Cara', reAvg: -5, kontraAvg: -9.5, color: expect.any(String) },
			{ key: 'Dave', reAvg: 0, kontraAvg: -2.5, color: expect.any(String) }
		]);

		expect(stats.avgPairs).toEqual([
			{ key: 'Alice & Bob', value: 29 / 3, color: expect.any(String) },
			{ key: 'Alice & Cara', value: 13 / 3, color: expect.any(String) },
			{ key: 'Alice & Dave', value: 32 / 3, color: expect.any(String) },
			{ key: 'Bob & Cara', value: -32 / 3, color: expect.any(String) },
			{ key: 'Bob & Dave', value: -13 / 3, color: expect.any(String) },
			{ key: 'Cara & Dave', value: -29 / 3, color: expect.any(String) }
		]);

		// Average eyes per player
		expect(stats.avgEyesGrouped).toEqual([
			{ player: 'Alice', Alice: 490 / 3, color: expect.any(String) },
			{ player: 'Bob', Bob: 350 / 3, color: expect.any(String) },
			{ player: 'Cara', Cara: 370 / 3, color: expect.any(String) },
			{ player: 'Dave', Dave: 230 / 3, color: expect.any(String) }
		]);
	});
});
