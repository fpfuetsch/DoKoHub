import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserOrFailMock, finishGameMock, deleteGameMock, gameRepositoryCtor } = vi.hoisted(
	() => {
		const requireUserOrFailMock = vi.fn();
		const finishGameMock = vi.fn();
		const deleteGameMock = vi.fn();

		const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
			this.finish = finishGameMock;
			this.delete = deleteGameMock;
		});

		return {
			requireUserOrFailMock,
			finishGameMock,
			deleteGameMock,
			gameRepositoryCtor
		};
	}
);

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('game detail load', () => {
	it('redirects to game rounds', async () => {
		const promise = load({ params: { group: 'group-1', game: 'game-1' } } as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/groups/group-1/games/game-1/rounds'
		});
	});
});

describe('game finish action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		finishGameMock.mockReset();
		gameRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const promise = actions.finish({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('finishes game successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		finishGameMock.mockResolvedValue({ ok: true });

		const result = await actions.finish({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(finishGameMock).toHaveBeenCalledWith('game-1', 'group-1', expect.any(Date));
		expect(result).toEqual({ success: true });
	});

	it('returns failure when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		finishGameMock.mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });

		const result = await actions.finish({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 404, data: { error: 'Game not found' } });
	});
});

describe('game delete action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		deleteGameMock.mockReset();
		gameRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const promise = actions.delete({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('deletes game successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteGameMock.mockResolvedValue({ ok: true });

		const result = await actions.delete({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(deleteGameMock).toHaveBeenCalledWith('game-1', 'group-1');
		expect(result).toEqual({ success: true });
	});

	it('returns failure when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteGameMock.mockResolvedValue({ ok: false, status: 403, error: 'Permission denied' });

		const result = await actions.delete({
			params: { group: 'group-1', game: 'game-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 403, data: { error: 'Permission denied' } });
	});
});
