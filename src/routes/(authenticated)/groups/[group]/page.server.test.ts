import { fail } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUserOrFailMock, renameMock, deleteMock, groupRepositoryCtor } = vi.hoisted(() => {
	const requireUserOrFailMock = vi.fn();
	const renameMock = vi.fn();
	const deleteMock = vi.fn();
	const groupRepositoryCtor = vi.fn(function MockGroupRepository(this: any) {
		this.rename = renameMock;
		this.delete = deleteMock;
	});
	return { requireUserOrFailMock, renameMock, deleteMock, groupRepositoryCtor };
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/group', () => ({
	GroupRepository: groupRepositoryCtor
}));

import { actions, load } from './+page.server';

describe('group detail load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		renameMock.mockReset();
		deleteMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('redirects to group games', async () => {
		const promise = load({ params: { group: 'group-1' } } as any);

		await expect(promise).rejects.toMatchObject({
			status: 302,
			location: '/groups/group-1/games'
		});
	});
});

describe('group rename action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		renameMock.mockReset();
		deleteMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('rejects when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});
		const formData = new FormData();
		formData.set('name', 'New Name');
		const request = new Request('http://localhost/groups/group-1', {
			method: 'POST',
			body: formData
		});

		const promise = actions.rename({ request, locals: { user: null }, params: { group: 'group-1' } } as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('renames the group when repository succeeds', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		renameMock.mockResolvedValue({ ok: true });
		const formData = new FormData();
		formData.set('name', 'New Name');
		const request = new Request('http://localhost/groups/group-1', {
			method: 'POST',
			body: formData
		});

		const result = await actions.rename({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(renameMock).toHaveBeenCalledWith('group-1', 'New Name');
		expect(result).toEqual({ success: true });
	});

	it('returns action failure when repository fails', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		renameMock.mockResolvedValue({ ok: false, status: 422, error: 'Bad name' });
		const formData = new FormData();
		formData.set('name', '');
		const request = new Request('http://localhost/groups/group-1', {
			method: 'POST',
			body: formData
		});

		const result = await actions.rename({
			request,
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({ status: 422, data: { error: 'Bad name' } });
	});
});

describe('group delete action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requireUserOrFailMock.mockReset();
		renameMock.mockReset();
		deleteMock.mockReset();
		groupRepositoryCtor.mockClear();
	});

	it('rejects when user is missing', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw fail(401, { error: 'Unauthorized' });
		});

		const promise = actions.delete({
			locals: { user: null },
			params: { group: 'group-1' }
		} as any);

		await expect(promise).rejects.toMatchObject({ status: 401 });
	});

	it('deletes the group when repository succeeds', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteMock.mockResolvedValue({ ok: true });

		const result = await actions.delete({
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(groupRepositoryCtor).toHaveBeenCalledWith('user-1');
		expect(deleteMock).toHaveBeenCalledWith('group-1');
		expect(result).toEqual({ success: true });
	});

	it('returns action failure when repository fails', async () => {
		requireUserOrFailMock.mockReturnValue({ id: 'user-1' });
		deleteMock.mockResolvedValue({ ok: false, status: 400, error: 'Cannot delete' });

		const result = await actions.delete({
			locals: { user: { id: 'user-1' } },
			params: { group: 'group-1' }
		} as any);

		expect(result).toMatchObject({ status: 400, data: { error: 'Cannot delete' } });
	});
});
