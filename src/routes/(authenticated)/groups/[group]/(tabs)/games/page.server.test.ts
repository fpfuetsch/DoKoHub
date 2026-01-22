import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	requireUserOrRedirectToLoginMock,
	requireUserOrFailMock,
	getByIdMock,
	listByGroupMock,
	createGameMock,
	groupRepositoryCtor,
	gameRepositoryCtor
} = vi.hoisted(() => {
	const requireUserOrRedirectToLoginMock = vi.fn();
	const requireUserOrFailMock = vi.fn();
	const getByIdMock = vi.fn();
	const listByGroupMock = vi.fn();
	const createGameMock = vi.fn();

	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.getById = getByIdMock;
	});

	const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
		this.listByGroup = listByGroupMock;
		this.create = createGameMock;
	});

	return {
		requireUserOrRedirectToLoginMock,
		requireUserOrFailMock,
		getByIdMock,
		listByGroupMock,
		createGameMock,
		groupRepositoryCtor,
		gameRepositoryCtor
	};
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock,
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('games page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrRedirectToLoginMock.mockReset();
		getByIdMock.mockReset();
		listByGroupMock.mockReset();
		groupRepositoryCtor.mockClear();
		gameRepositoryCtor.mockClear();
	});

	it('redirects unauthenticated users to login', async () => {
		requireUserOrRedirectToLoginMock.mockImplementation(() => {
			throw Object.assign(new Error('redirect'), {
				status: 302,
				location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames'
			});
		});

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1/games')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fgames'
		});
	});

	it('throws error when group is not found', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Group not found' });

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Group not found' }
		});
	});

	it('throws error when games cannot be fetched', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: true, value: { id: 'group-1', name: 'Group One' } });
		listByGroupMock.mockResolvedValue({ ok: false, status: 500, error: 'Database error' });

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 500,
			body: { message: 'Database error' }
		});
	});

	it('returns group and games on success', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		const group = { id: 'group-1', name: 'Group One' };
		const games = [{ id: 'game-1', rounds: [] }];
		getByIdMock.mockResolvedValue({ ok: true, value: group });
		listByGroupMock.mockResolvedValue({ ok: true, value: games });

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/games')
		} as any)) as { group: unknown; games: unknown[] };

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(result.group).toEqual(group);
		expect(result.games).toBe(games);
	});
});

describe('games page create action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		createGameMock.mockReset();
		gameRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		formData.set('maxRoundCount', '10');
		formData.set('withMandatorySolos', 'true');
		const request = new Request('http://localhost/groups/group-1/games', {
			method: 'POST',
			body: formData
		});

		const promise = actions.create({
			request,
			locals: { user: null },
			params: { group: 'group-1' }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('creates game with 4 players', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createGameMock.mockResolvedValue({ ok: true, value: { id: 'game-1' } });

		const formData = new FormData();
		formData.set('maxRoundCount', '10');
		formData.set('withMandatorySolos', 'true');
		formData.set('player_0', 'player-1');
		formData.set('player_1', 'player-2');
		formData.set('player_2', 'player-3');
		formData.set('player_3', 'player-4');
		const request = new Request('http://localhost/groups/group-1/games', {
			method: 'POST',
			body: formData
		});

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(createGameMock).toHaveBeenCalledWith('group-1', 10, true, [
			'player-1',
			'player-2',
			'player-3',
			'player-4'
		]);
		expect(result).toEqual({ success: true, gameId: 'game-1' });
	});

	it('creates game with 5 players when player_4 is provided', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createGameMock.mockResolvedValue({ ok: true, value: { id: 'game-1' } });

		const formData = new FormData();
		formData.set('maxRoundCount', '12');
		formData.set('withMandatorySolos', 'false');
		formData.set('player_0', 'player-1');
		formData.set('player_1', 'player-2');
		formData.set('player_2', 'player-3');
		formData.set('player_3', 'player-4');
		formData.set('player_4', 'player-5');
		const request = new Request('http://localhost/groups/group-1/games', {
			method: 'POST',
			body: formData
		});

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(createGameMock).toHaveBeenCalledWith('group-1', 12, false, [
			'player-1',
			'player-2',
			'player-3',
			'player-4',
			'player-5'
		]);
		expect(result).toEqual({ success: true, gameId: 'game-1' });
	});

	it('returns failure when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createGameMock.mockResolvedValue({ ok: false, status: 422, error: 'Invalid players' });

		const formData = new FormData();
		formData.set('maxRoundCount', '10');
		formData.set('withMandatorySolos', 'true');
		formData.set('player_0', 'player-1');
		formData.set('player_1', 'player-2');
		formData.set('player_2', 'player-3');
		formData.set('player_3', 'player-4');
		const request = new Request('http://localhost/groups/group-1/games', {
			method: 'POST',
			body: formData
		});

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({ status: 422, data: { error: 'Invalid players' } });
	});

	it('returns failure with generic error message on exception', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createGameMock.mockImplementation(() => {
			throw new Error('Unexpected database error');
		});

		const formData = new FormData();
		formData.set('maxRoundCount', '10');
		formData.set('withMandatorySolos', 'true');
		formData.set('player_0', 'player-1');
		formData.set('player_1', 'player-2');
		formData.set('player_2', 'player-3');
		formData.set('player_3', 'player-4');
		const request = new Request('http://localhost/groups/group-1/games', {
			method: 'POST',
			body: formData
		});

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Unexpected database error' }
		});
	});
});
