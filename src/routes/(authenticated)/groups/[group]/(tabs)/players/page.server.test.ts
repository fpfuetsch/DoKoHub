import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	requireUserOrFailMock,
	getByIdMock,
	leaveRepoMock,
	createLocalPlayerMock,
	deleteLocalPlayerMock,
	renameLocalPlayerMock,
	groupRepositoryCtor,
	playerRepositoryCtor,
	signInviteMock
} = vi.hoisted(() => {
	const requireUserOrFailMock = vi.fn();
	const getByIdMock = vi.fn();
	const leaveRepoMock = vi.fn();
	const createLocalPlayerMock = vi.fn();
	const deleteLocalPlayerMock = vi.fn();
	const renameLocalPlayerMock = vi.fn();
	const signInviteMock = vi.fn();

	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.getById = getByIdMock;
		this.leave = leaveRepoMock;
	});

	const playerRepositoryCtor = vi.fn(function MockPlayerRepository(this: any) {
		this.createLocal = createLocalPlayerMock;
		this.deleteLocal = deleteLocalPlayerMock;
		this.renameLocal = renameLocalPlayerMock;
	});

	return {
		requireUserOrFailMock,
		getByIdMock,
		leaveRepoMock,
		createLocalPlayerMock,
		deleteLocalPlayerMock,
		renameLocalPlayerMock,
		signInviteMock,
		groupRepositoryCtor,
		playerRepositoryCtor
	};
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

vi.mock('$lib/server/repositories/player', () => ({
	PlayerRepository: playerRepositoryCtor
}));

vi.mock('$lib/server/auth/invitation', () => ({
	signInvite: signInviteMock
}));

import { actions } from './+page.server';

describe('players page generateInvite action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		getByIdMock.mockReset();
		signInviteMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const promise = actions.generateInvite({
			params: { group: 'group-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1/players')
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when group does not exist', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Group not found' });

		const result = await actions.generateInvite({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/players')
		} as any);

		expect(result).toMatchObject({ status: 404, data: { error: 'Group not found' } });
	});

	it('generates invite token with correct URL', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: true, value: { id: 'group-1', name: 'Test Group' } });
		signInviteMock.mockResolvedValue('secret-token-123');

		const result = await actions.generateInvite({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost:5173/groups/group-1/players')
		} as any);

		expect(signInviteMock).toHaveBeenCalledWith({
			groupId: 'group-1',
			groupName: 'Test Group'
		});
		expect(result).toEqual({
			success: true,
			inviteUrl: 'http://localhost:5173/groups/group-1/join?t=secret-token-123'
		});
	});
});

describe('players page leave action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		leaveRepoMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const promise = actions.leave({
			params: { group: 'group-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when leave returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		leaveRepoMock.mockResolvedValue({ ok: false, status: 400, error: 'Cannot leave' });

		const result = await actions.leave({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Cannot leave' } });
	});

	it('returns success when user leaves without deleting group', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		leaveRepoMock.mockResolvedValue({ ok: true, value: { deletedGroup: false } });

		const result = await actions.leave({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(leaveRepoMock).toHaveBeenCalledWith('group-1');
		expect(result).toEqual({ success: true, leftGroup: true, deletedGroup: false });
	});

	it('returns success when user leaves and group is deleted', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		leaveRepoMock.mockResolvedValue({ ok: true, value: { deletedGroup: true } });

		const result = await actions.leave({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toEqual({ success: true, leftGroup: true, deletedGroup: true });
	});
});

describe('players page createLocal action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		createLocalPlayerMock.mockReset();
		playerRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		formData.set('playerName', 'John');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const promise = actions.createLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createLocalPlayerMock.mockResolvedValue({
			ok: false,
			status: 422,
			error: 'Invalid name'
		});

		const formData = new FormData();
		formData.set('playerName', '');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.createLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 422, data: { error: 'Invalid name' } });
	});

	it('creates local player successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		createLocalPlayerMock.mockResolvedValue({ ok: true, value: { id: 'player-1' } });

		const formData = new FormData();
		formData.set('playerName', 'John Doe');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.createLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(playerRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(createLocalPlayerMock).toHaveBeenCalledWith('John Doe', 'group-1');
		expect(result).toEqual({ success: true });
	});
});

describe('players page removeLocal action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		deleteLocalPlayerMock.mockReset();
		playerRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const promise = actions.removeLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when playerId is missing', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });

		const formData = new FormData();
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.removeLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Spieler ID fehlt.' } });
		expect(deleteLocalPlayerMock).not.toHaveBeenCalled();
	});

	it('fails when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteLocalPlayerMock.mockResolvedValue({
			ok: false,
			status: 404,
			error: 'Player not found'
		});

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.removeLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({ status: 404, data: { error: 'Player not found' } });
	});

	it('removes local player successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteLocalPlayerMock.mockResolvedValue({ ok: true });

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.removeLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(playerRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(deleteLocalPlayerMock).toHaveBeenCalledWith('player-1', 'group-1');
		expect(result).toEqual({ success: true });
	});
});

describe('players page renameLocal action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		renameLocalPlayerMock.mockReset();
		playerRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		formData.set('displayName', 'New Name');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const promise = actions.renameLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: null }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when repository returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		renameLocalPlayerMock.mockResolvedValue({
			ok: false,
			status: 422,
			error: 'Invalid name'
		});

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		formData.set('displayName', '');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.renameLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(result).toMatchObject({
			status: 422,
			data: { error: 'Invalid name', values: { displayName: '' } }
		});
	});

	it('renames local player successfully', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		renameLocalPlayerMock.mockResolvedValue({ ok: true });

		const formData = new FormData();
		formData.set('playerId', 'player-1');
		formData.set('displayName', '  New Name  ');
		const request = new Request('http://localhost/groups/group-1/players', {
			method: 'POST',
			body: formData
		});

		const result = await actions.renameLocal({
			request,
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } }
		} as any);

		expect(playerRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(renameLocalPlayerMock).toHaveBeenCalledWith('player-1', 'group-1', 'New Name');
		expect(result).toEqual({ success: true });
	});
});
