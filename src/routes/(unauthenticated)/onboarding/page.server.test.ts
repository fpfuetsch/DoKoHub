import { fail, redirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	playerRepositoryMock,
	playerRepositoryCtor,
	createSessionTokenMock,
	verifyOnboardingTokenMock
} = vi.hoisted(() => {
	const createMock = vi.fn();
	const playerRepositoryCtor = vi.fn(function MockPlayerRepository(this: any) {
		this.create = createMock;
	});

	const createSessionTokenMock = vi.fn();
	const verifyOnboardingTokenMock = vi.fn();

	return {
		playerRepositoryMock: createMock,
		playerRepositoryCtor,
		createSessionTokenMock,
		verifyOnboardingTokenMock
	};
});

vi.mock('$lib/server/repositories/player', () => ({
	PlayerRepository: playerRepositoryCtor
}));

vi.mock('$lib/server/auth/session', () => ({
	createSessionToken: createSessionTokenMock,
	SESSION_COOKIE_NAME: 'session',
	sessionCookieAttributes: { path: '/' }
}));

vi.mock('$lib/server/auth/onboarding', () => ({
	verifyOnboardingToken: verifyOnboardingTokenMock,
	ONBOARDING_COOKIE: 'onboarding',
	onboardingCookieAttributes: { path: '/' }
}));

import { actions, load } from './+page.server';

describe('onboarding load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyOnboardingTokenMock.mockReset();
	});

	it('redirects to /groups when user is already logged in', async () => {
		await expect(
			load({
				locals: { user: { id: 'user-1' } },
				cookies: {
					get: vi.fn(),
					delete: vi.fn()
				}
			} as any)
		).rejects.toThrow();
	});

	it('redirects to /login when onboarding cookie is missing', async () => {
		const cookiesMock = {
			get: vi.fn().mockReturnValue(null),
			delete: vi.fn()
		};

		await expect(
			load({
				locals: { user: null },
				cookies: cookiesMock
			} as any)
		).rejects.toThrow();

		expect(cookiesMock.delete).toHaveBeenCalledWith('onboarding', { path: '/' });
	});

	it('redirects to /login when onboarding token is invalid', async () => {
		verifyOnboardingTokenMock.mockResolvedValue(null);
		const cookiesMock = {
			get: vi.fn().mockReturnValue('invalid-token'),
			delete: vi.fn()
		};

		await expect(
			load({
				locals: { user: null },
				cookies: cookiesMock
			} as any)
		).rejects.toThrow();

		expect(cookiesMock.delete).toHaveBeenCalledWith('onboarding', { path: '/' });
	});

	it('returns suggested display name from valid onboarding token', async () => {
		verifyOnboardingTokenMock.mockResolvedValue({
			suggestedDisplayName: 'John Doe',
			provider: 'google',
			providerId: 'google-123'
		});
		const cookiesMock = {
			get: vi.fn().mockReturnValue('valid-token'),
			delete: vi.fn()
		};

		const result = await load({
			locals: { user: null },
			cookies: cookiesMock
		} as any);

		expect(result).toEqual({
			defaults: {
				displayName: 'John Doe'
			}
		});
	});

	it('returns empty display name when suggested name is invalid', async () => {
		verifyOnboardingTokenMock.mockResolvedValue({
			suggestedDisplayName: 'x'.repeat(300), // too long
			provider: 'google',
			providerId: 'google-123'
		});
		const cookiesMock = {
			get: vi.fn().mockReturnValue('valid-token'),
			delete: vi.fn()
		};

		const result = await load({
			locals: { user: null },
			cookies: cookiesMock
		} as any);

		expect(result).toEqual({
			defaults: {
				displayName: ''
			}
		});
	});
});

describe('onboarding save action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		verifyOnboardingTokenMock.mockReset();
		playerRepositoryMock.mockReset();
		createSessionTokenMock.mockReset();
		playerRepositoryCtor.mockClear();
	});

	it('fails when onboarding cookie is missing', async () => {
		const cookiesMock = {
			get: vi.fn().mockReturnValue(null),
			delete: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.set('displayName', 'John Doe');
		const request = new Request('http://localhost/onboarding', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			cookies: cookiesMock
		} as any);

		expect(result).toMatchObject({
			status: 401,
			data: { message: 'Anmeldung abgelaufen. Bitte erneut anmelden.' }
		});
	});

	it('fails when onboarding token is invalid', async () => {
		verifyOnboardingTokenMock.mockResolvedValue(null);
		const cookiesMock = {
			get: vi.fn().mockReturnValue('invalid-token'),
			delete: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.set('displayName', 'John Doe');
		const request = new Request('http://localhost/onboarding', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			cookies: cookiesMock
		} as any);

		expect(result).toMatchObject({
			status: 401,
			data: { message: 'Anmeldung abgelaufen. Bitte erneut anmelden.' }
		});
		expect(cookiesMock.delete).toHaveBeenCalledWith('onboarding', { path: '/' });
	});

	it('fails when display name is invalid', async () => {
		verifyOnboardingTokenMock.mockResolvedValue({
			suggestedDisplayName: 'John Doe',
			provider: 'google',
			providerId: 'google-123',
			redirectTo: '/groups'
		});
		const cookiesMock = {
			get: vi.fn().mockReturnValue('valid-token'),
			delete: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.set('displayName', ''); // empty name
		const request = new Request('http://localhost/onboarding', {
			method: 'POST',
			body: formData
		});

		const result = await actions.save({
			request,
			cookies: cookiesMock
		} as any);

		expect(result).toMatchObject({
			status: 400,
			data: expect.objectContaining({ errors: expect.any(Object) })
		});
	});

	it('creates player and session successfully', async () => {
		verifyOnboardingTokenMock.mockResolvedValue({
			suggestedDisplayName: 'John Doe',
			provider: 'google',
			providerId: 'google-123',
			redirectTo: '/groups'
		});
		playerRepositoryMock.mockResolvedValue({
			id: 'player-1',
			displayName: 'John Doe',
			authProvider: 'google',
			authProviderId: 'google-123',
			createdAt: new Date()
		});
		createSessionTokenMock.mockResolvedValue('session-token');

		const cookiesMock = {
			get: vi.fn().mockReturnValue('valid-token'),
			delete: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.set('displayName', 'John Doe');
		const request = new Request('http://localhost/onboarding', {
			method: 'POST',
			body: formData
		});

		await expect(() =>
			actions.save({
				request,
				cookies: cookiesMock
			} as any)
		).rejects.toThrow();
	});

	it('redirects to custom redirectTo when provided', async () => {
		verifyOnboardingTokenMock.mockResolvedValue({
			suggestedDisplayName: 'John Doe',
			provider: 'google',
			providerId: 'google-123',
			redirectTo: '/custom-path'
		});
		playerRepositoryMock.mockResolvedValue({
			id: 'player-1',
			displayName: 'John Doe',
			authProvider: 'google',
			authProviderId: 'google-123',
			createdAt: new Date()
		});
		createSessionTokenMock.mockResolvedValue('session-token');

		const cookiesMock = {
			get: vi.fn().mockReturnValue('valid-token'),
			delete: vi.fn(),
			set: vi.fn()
		};

		const formData = new FormData();
		formData.set('displayName', 'John Doe');
		const request = new Request('http://localhost/onboarding', {
			method: 'POST',
			body: formData
		});

		await expect(() =>
			actions.save({
				request,
				cookies: cookiesMock
			} as any)
		).rejects.toThrow();
	});
});
