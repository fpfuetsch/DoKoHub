import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	verifyInviteMock,
	requireUserOrRedirectToLoginMock,
	requireUserOrFailMock,
	getByIdMock,
	addMemberMock,
	groupRepositoryCtor
} = vi.hoisted(() => {
	const verifyInviteMock = vi.fn();
	const requireUserOrRedirectToLoginMock = vi.fn();
	const requireUserOrFailMock = vi.fn();
	const getByIdMock = vi.fn();
	const addMemberMock = vi.fn();
	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.getById = getByIdMock;
		this.addMember = addMemberMock;
	});

	return {
		verifyInviteMock,
		requireUserOrRedirectToLoginMock,
		requireUserOrFailMock,
		getByIdMock,
		addMemberMock,
		groupRepositoryCtor
	};
});

vi.mock('$lib/server/auth/invitation', () => ({
	verifyInvite: verifyInviteMock
}));

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock,
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('join group load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyInviteMock.mockReset();
		requireUserOrRedirectToLoginMock.mockReset();
		getByIdMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('redirects unauthenticated users to login', async () => {
		requireUserOrRedirectToLoginMock.mockImplementation(() => {
			throw Object.assign(new Error('redirect'), {
				status: 302,
				location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fjoin'
			});
		});

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1/join')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups%2Fgroup-1%2Fjoin'
		});
	});

	it('returns invalid when no token provided', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/join')
		} as any)) as { valid: boolean };

		expect(result).toEqual({ valid: false });
		expect(verifyInviteMock).not.toHaveBeenCalled();
	});

	it('returns invalid when token is invalid', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue(null);

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/join?t=invalid-token')
		} as any)) as { valid: boolean };

		expect(verifyInviteMock).toHaveBeenCalledWith('invalid-token');
		expect(result).toEqual({ valid: false });
	});

	it('returns invalid when token groupId does not match route param', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'other-group', groupName: 'Other' });

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/join?t=token')
		} as any)) as { valid: boolean };

		expect(result).toEqual({ valid: false });
	});

	it('redirects to group page if user is already a member', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'group-1', groupName: 'Group One' });
		getByIdMock.mockResolvedValue({ ok: true, value: { id: 'group-1' } });

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/join?t=token')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 303,
			location: '/groups/group-1/'
		});
	});

	it('returns valid invitation details when not yet a member', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'group-1', groupName: 'Group One' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Not found' });

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1/join?t=valid-token')
		} as any)) as {
			valid: boolean;
			groupId: string;
			groupName: string;
			token: string;
		};

		expect(result).toEqual({
			valid: true,
			groupId: 'group-1',
			groupName: 'Group One',
			token: 'valid-token'
		});
	});
});

describe('join group accept action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyInviteMock.mockReset();
		requireUserOrFailMock.mockReset();
		addMemberMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('fails when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const formData = new FormData();
		formData.set('token', 'token');
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const promise = actions.accept({
			request,
			locals: { user: null },
			params: { group: 'group-1' }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('fails when no token provided', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });

		const formData = new FormData();
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const result = await actions.accept({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Kein Token.' } });
	});

	it('fails when token is invalid', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue(null);

		const formData = new FormData();
		formData.set('token', 'invalid-token');
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const result = await actions.accept({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Ungültige oder abgelaufene Einladung.' }
		});
	});

	it('fails when token groupId does not match route param', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'other-group', groupName: 'Other' });

		const formData = new FormData();
		formData.set('token', 'token');
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const result = await actions.accept({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invite gehört zu einer anderen Gruppe.' }
		});
	});

	it('fails when addMember returns error', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'group-1', groupName: 'Group One' });
		addMemberMock.mockResolvedValue({ ok: false, status: 400, error: 'Already member' });

		const formData = new FormData();
		formData.set('token', 'token');
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const result = await actions.accept({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Already member' } });
	});

	it('redirects to group page on successful join', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		verifyInviteMock.mockResolvedValue({ groupId: 'group-1', groupName: 'Group One' });
		addMemberMock.mockResolvedValue({ ok: true });

		const formData = new FormData();
		formData.set('token', 'valid-token');
		const request = new Request('http://localhost/groups/group-1/join', {
			method: 'POST',
			body: formData
		});

		const promise = actions.accept({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 303,
			location: '/groups/group-1'
		});
		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(addMemberMock).toHaveBeenCalledWith('group-1', 'user-1', true);
	});
});
