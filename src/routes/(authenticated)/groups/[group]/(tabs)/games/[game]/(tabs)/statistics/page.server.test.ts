import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserOrRedirectToLoginMock, getGameStatisticsMock } = vi.hoisted(() => {
	const requireUserOrRedirectToLoginMock = vi.fn();
	const getGameStatisticsMock = vi.fn();

	return { requireUserOrRedirectToLoginMock, getGameStatisticsMock };
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock
}));

vi.mock('$lib/server/statistics/game', () => ({
	getGameStatistics: getGameStatisticsMock
}));

import { load } from './+page.server';

describe('statistics page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrRedirectToLoginMock.mockReset();
		getGameStatisticsMock.mockReset();
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

	it('returns statsPromise that rejects when getGameStatistics throws', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getGameStatisticsMock.mockRejectedValue(
			Object.assign(new Error('Game not found'), { status: 404 })
		);

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		// Verify the promise rejects
		await expect(result.statsPromise).rejects.toBeDefined();
	});

	it('returns statsPromise that rejects when game has no rounds', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getGameStatisticsMock.mockRejectedValue(
			Object.assign(new Error('Spiel nicht gefunden.'), { status: 404 })
		);

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		// Verify the promise rejects
		await expect(result.statsPromise).rejects.toBeDefined();
	});

	it('calls getGameStatistics and returns statsPromise', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getGameStatisticsMock.mockResolvedValue({
			playerSeries: { rows: [], series: [] },
			reKontraShare: [],
			avgReKontra: [],
			avgPairs: [],
			bonusGrouped: [],
			avgEyesGrouped: [],
			avgEyes: [],
			callGrouped: []
		});

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		expect(getGameStatisticsMock).toHaveBeenCalledWith({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1'
		});
		expect(result.statsPromise).toBeInstanceOf(Promise);

		const stats = await result.statsPromise;
		expect(stats).toBeDefined();
	});

	it('streaming: loads stats asynchronously without blocking', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getGameStatisticsMock.mockResolvedValue({
			playerSeries: { rows: [], series: [] },
			reKontraShare: [],
			avgReKontra: [],
			avgPairs: [],
			bonusGrouped: [],
			avgEyesGrouped: [],
			avgEyes: [],
			callGrouped: []
		});

		// Load returns immediately
		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1/statistics')
		} as any)) as { statsPromise: Promise<any> };

		// Verify stats haven't been calculated yet (promise is pending)
		expect(result.statsPromise).toBeInstanceOf(Promise);

		// Eventually resolves
		const stats = await result.statsPromise;
		expect(stats).toBeDefined();

		// Service was called with correct params
		expect(getGameStatisticsMock).toHaveBeenCalledWith({
			principalId: 'user-1',
			gameId: 'game-1',
			groupId: 'group-1'
		});
	});
});
