import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserOrRedirectToLoginMock, getByIdMock, groupRepositoryCtor } = vi.hoisted(() => {
	const requireUserOrRedirectToLoginMock = vi.fn();
	const getByIdMock = vi.fn();
	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.getById = getByIdMock;
	});
	return { requireUserOrRedirectToLoginMock, getByIdMock, groupRepositoryCtor };
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrRedirectToLogin: requireUserOrRedirectToLoginMock
}));

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

import { load } from './+layout.server';

describe('group layout load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrRedirectToLoginMock.mockReset();
		getByIdMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('redirects unauthenticated users to login', async () => {
		requireUserOrRedirectToLoginMock.mockImplementation(() => {
			throw Object.assign(new Error('redirect'), {
				status: 302,
				location: '/login?redirectTo=%2Fgroups%2Fgroup-1'
			});
		});

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: null },
			url: new URL('http://localhost/groups/group-1')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups%2Fgroup-1'
		});
	});

	it('returns group and user when repository succeeds', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		const group = { id: 'group-1', name: 'Group One' };
		getByIdMock.mockResolvedValue({ ok: true, value: group });

		const result = (await load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1')
		} as any)) as { group: unknown; user: unknown };

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(getByIdMock).toHaveBeenCalledWith('group-1');
		expect(result.group).toBe(group);
		expect(result.user).toEqual({ id: 'user-1' });
	});

	it('throws http error when repository rejects', async () => {
		requireUserOrRedirectToLoginMock.mockReturnValue({ id: 'user-1' });
		getByIdMock.mockResolvedValue({ ok: false, status: 404, error: 'Not found' });

		const promise = load({
			params: { group: 'group-1' },
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost/groups/group-1')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
	});
});
