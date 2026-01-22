import { describe, expect, it } from 'vitest';
import { requireUserOrRedirectToLogin, requireUserOrFail } from './guard';
import type { AuthenticatedUser } from './guard';
import { AuthProvider } from '$lib/server/enums';

describe('Guard', () => {
	describe('requireUserOrRedirectToLogin', () => {
		it('returns user when authenticated', () => {
			const mockUser: AuthenticatedUser = {
				id: 'user-123',
				displayName: 'Test User',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|123',
				createdAt: new Date()
			};

			const event = {
				locals: { user: mockUser },
				url: new URL('https://example.com/dashboard')
			};

			const result = requireUserOrRedirectToLogin(event);
			expect(result).toBe(mockUser);
		});

		it('throws redirect when user is not authenticated', () => {
			const event = {
				locals: { user: null },
				url: new URL('https://example.com/dashboard?tab=games')
			};

			expect(() => requireUserOrRedirectToLogin(event)).toThrow();
			try {
				requireUserOrRedirectToLogin(event);
			} catch (error: any) {
				expect(error.status).toBe(302);
				expect(error.location).toBe('/login?redirectTo=%2Fdashboard%3Ftab%3Dgames');
			}
		});

		it('encodes redirect URL with special characters', () => {
			const event = {
				locals: { user: null },
				url: new URL('https://example.com/groups/abc-123?filter=active&sort=name')
			};

			try {
				requireUserOrRedirectToLogin(event);
			} catch (error: any) {
				expect(error.location).toBe(
					'/login?redirectTo=%2Fgroups%2Fabc-123%3Ffilter%3Dactive%26sort%3Dname'
				);
			}
		});
	});

	describe('requireUserOrFail', () => {
		it('returns user when authenticated', () => {
			const mockUser: AuthenticatedUser = {
				id: 'user-456',
				displayName: 'Another User',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const event = {
				locals: { user: mockUser }
			};

			const result = requireUserOrFail(event);
			expect(result).toBe(mockUser);
		});

		it('throws 401 fail when user is not authenticated', () => {
			const event = {
				locals: { user: null }
			};

			expect(() => requireUserOrFail(event)).toThrow();
			try {
				requireUserOrFail(event);
			} catch (error: any) {
				expect(error.status).toBe(401);
				expect(error.data).toEqual({ error: 'Unauthorized' });
			}
		});
	});
});
