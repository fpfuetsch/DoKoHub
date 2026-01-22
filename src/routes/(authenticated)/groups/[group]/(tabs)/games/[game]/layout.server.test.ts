import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserOrRedirectToLoginMock, getByIdMock, gameRepositoryCtor } = vi.hoisted(() => {
	const requireUserOrRedirectToLoginMock = vi.fn();
	const getByIdMock = vi.fn();

	const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
		this.getById = getByIdMock;
	});

	return {
		requireUserOrRedirectToLoginMock,
		getByIdMock,
		gameRepositoryCtor
	};
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

import { load } from './+layout.server';

describe('game layout load', () => {
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
				location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames%2Fgame-1'
			});
		});

		const promise = load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1/games/game-1')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames%2Fgame-1'
		});
	});

	it('throws error when game is not found', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });

		const promise = load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Game not found' }
		});
	});

	it('returns game on success', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		const game = { id: 'game-1', rounds: [] };
		getByIdMock.mockResolvedValue({ ok: true, value: game });

		const result = (await load({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games/game-1')
		} as any)) as { game: unknown };

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(getByIdMock).toHaveBeenCalledWith('game-1', 'group-1');
		expect(result.game).toBe(game);
	});
});
