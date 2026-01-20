import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMock, createMock, groupRepositoryCtor } = vi.hoisted(() => {
	const listMock = vi.fn();
	const createMock = vi.fn();
	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.list = listMock;
		this.create = createMock;
	});

	return { listMock, createMock, groupRepositoryCtor };
});

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('groups page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listMock.mockReset();
		createMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('redirects anonymous users to login', async () => {
		const promise = load({
			locals: { user: null },
			url: new URL('http://localhost/groups')
		} as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/login?redirectTo=%2Fgroups'
		});
	});

	it('returns groups for authenticated users', async () => {
		const groups = [{ id: 'group-1' }];
		listMock.mockResolvedValue(groups);

		const result = (await load({
			locals: { user: { id: 'user-123' } as any },
			url: new URL('http://localhost/groups')
		} as any)) as { groups: unknown[] };

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-123');
		expect(listMock).toHaveBeenCalledTimes(1);
		expect(result.groups).toBe(groups);
	});
});

describe('groups create action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		listMock.mockReset();
		createMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('fails for anonymous users', async () => {
		const formData = new FormData();
		formData.set('groupName', 'New Group');
		const request = new Request('http://localhost/groups', { method: 'POST', body: formData });

		const promise = actions.create({ request, locals: { user: null } } as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('creates a group when repository succeeds', async () => {
		createMock.mockResolvedValue({ ok: true, value: { id: 'group-123' } });
		const formData = new FormData();
		formData.set('groupName', 'My Group');
		const request = new Request('http://localhost/groups', { method: 'POST', body: formData });

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-123' } as any }
		} as any);

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-123');
		expect(createMock).toHaveBeenCalledWith('My Group');
		expect(result).toEqual({ success: true, groupId: 'group-123' });
	});

	it('returns action failure when repository rejects the name', async () => {
		createMock.mockResolvedValue({ ok: false, status: 422, error: 'Invalid name' });
		const formData = new FormData();
		formData.set('groupName', '');
		const request = new Request('http://localhost/groups', { method: 'POST', body: formData });

		const result = await actions.create({
			request,
			locals: { user: { id: 'user-123' } as any }
		} as any);

		expect(result).toMatchObject({
			status: 422,
			data: {
				error: 'Invalid name',
				values: { groupName: '' }
			}
		});
	});
});
