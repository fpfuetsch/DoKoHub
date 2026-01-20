import { redirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('login load', () => {
	it('returns redirectTo from search params', async () => {
		const url = new URL('http://localhost/login?redirectTo=/groups/group-1');
		const result = await load({
			locals: { user: null },
			url
		} as any);

		expect(result).toEqual({ redirectTo: '/groups/group-1' });
	});

	it('returns null redirectTo when not provided', async () => {
		const url = new URL('http://localhost/login');
		const result = await load({
			locals: { user: null },
			url
		} as any);

		expect(result).toEqual({ redirectTo: null });
	});

	it('throws redirect to /groups when user is already logged in', async () => {
		const url = new URL('http://localhost/login');

		await expect(
			load({
				locals: { user: { id: 'user-1' } },
				url
			} as any)
		).rejects.toThrow();
	});

	it('throws redirect to redirectTo when user is logged in and redirectTo is provided', async () => {
		const url = new URL('http://localhost/login?redirectTo=/profile');

		await expect(
			load({
				locals: { user: { id: 'user-1' } },
				url
			} as any)
		).rejects.toThrow();
	});
});
