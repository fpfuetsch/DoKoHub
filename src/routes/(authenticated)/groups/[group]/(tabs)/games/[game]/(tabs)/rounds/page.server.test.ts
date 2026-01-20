import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	requireUserOrFailMock,
	getByIdGameMock,
	addRoundMock,
	updateRoundMock,
	gameRepositoryCtor,
	roundRepositoryCtor
} = vi.hoisted(() => {
	const requireUserOrFailMock = vi.fn();
	const getByIdGameMock = vi.fn();
	const addRoundMock = vi.fn();
	const updateRoundMock = vi.fn();

	const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
		this.getById = getByIdGameMock;
	});

	const roundRepositoryCtor = vi.fn(function MockRoundRepository(this: any) {
		this.addRound = addRoundMock;
		this.updateRound = updateRoundMock;
	});

	return {
		requireUserOrFailMock,
		getByIdGameMock,
		addRoundMock,
		updateRoundMock,
		gameRepositoryCtor,
		roundRepositoryCtor
	};
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

vi.mock('$lib/server/repositories/round', () => ({
	RoundRepository: roundRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('rounds load', () => {
	it('returns parent data', async () => {
		const parentData = { game: { id: 'game-1' } };
		const result = await load({
			parent: vi.fn().mockResolvedValue(parentData)
		} as any);

		expect(result).toEqual(parentData);
	});
});

describe('rounds save action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		getByIdGameMock.mockReset();
		addRoundMock.mockReset();
		updateRoundMock.mockReset();
		gameRepositoryCtor.mockClear();
		roundRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const promise = actions.save({
			request,
			locals: { user: null },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when game is not found', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdGameMock.mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });

		const formData = new FormData();
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		expect(result).toMatchObject({ status: 404, data: { error: 'Game not found' } });
	});

	it('fails when updating non-existent round', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: {
				id: 'game-1',
				participants: [{ playerId: 'p1', seatPosition: 0, player: {} }],
				rounds: [{ id: 'round-1', roundNumber: 1 }]
			}
		});

		const formData = new FormData();
		formData.set('roundId', 'non-existent-round');
		formData.set('type', 'Normal');
		formData.set('eyesRe', '121');
		formData.set('player_0_team', 'RE');
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Runde nicht gefunden.' } });
	});

	it('creates new round successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: {
				id: 'game-1',
				participants: [
					{ playerId: 'p1', seatPosition: 0, player: { id: 'p1' } },
					{ playerId: 'p2', seatPosition: 1, player: { id: 'p2' } }
				],
				rounds: []
			}
		});
		addRoundMock.mockResolvedValue({ ok: true });

		const formData = new FormData();
		formData.set('type', 'Normal');
		formData.set('eyesRe', '121');
		formData.set('player_0_team', 'RE');
		formData.set('player_1_team', 'KONTRA');
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		expect(roundRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(addRoundMock).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	it('updates existing round successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: {
				id: 'game-1',
				participants: [
					{ playerId: 'p1', seatPosition: 0, player: { id: 'p1' } },
					{ playerId: 'p2', seatPosition: 1, player: { id: 'p2' } }
				],
				rounds: [{ id: 'round-1', roundNumber: 1 }]
			}
		});
		updateRoundMock.mockResolvedValue({ ok: true });

		const formData = new FormData();
		formData.set('roundId', 'round-1');
		formData.set('type', 'Normal');
		formData.set('eyesRe', '90');
		formData.set('player_0_team', 'RE');
		formData.set('player_1_team', 'KONTRA');
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		expect(roundRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(updateRoundMock).toHaveBeenCalled();
		expect(result).toEqual({ success: true });
	});

	it('fails when add round repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: {
				id: 'game-1',
				participants: [{ playerId: 'p1', seatPosition: 0, player: { id: 'p1' } }],
				rounds: []
			}
		});
		addRoundMock.mockResolvedValue({ ok: false, status: 422, error: 'Invalid round data' });

		const formData = new FormData();
		formData.set('type', 'Normal');
		formData.set('eyesRe', '121');
		formData.set('player_0_team', 'RE');
		const request = new Request('http://localhost/groups/group-1/games/game-1/rounds', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1', game: 'game-1' }
		} as any);

		expect(result).toMatchObject({ status: 422, data: { error: 'Invalid round data' } });
	});
});
