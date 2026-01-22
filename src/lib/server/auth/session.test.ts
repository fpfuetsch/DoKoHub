import { describe, expect, it, vi } from 'vitest';
import {
	createSessionToken,
	verifySessionToken,
	SESSION_MAX_AGE_SECONDS,
	type SessionTokenPayload
} from './session';
import { AuthProvider } from '$lib/server/enums';
import type { PlayerType } from '$lib/server/db/schema';

describe('Session', () => {
	describe('createSessionToken', () => {
		it('creates a JWT token for a Google user', async () => {
			const user: PlayerType = {
				id: 'user-123',
				displayName: 'John Doe',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|123456',
				createdAt: new Date()
			};

			const token = await createSessionToken(user);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('creates a JWT token for a Local user', async () => {
			const user: PlayerType = {
				id: 'user-456',
				displayName: 'Jane Smith',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const token = await createSessionToken(user);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
		});

		it('creates different tokens for different users', async () => {
			const user1: PlayerType = {
				id: 'user-1',
				displayName: 'User One',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|1',
				createdAt: new Date()
			};

			const user2: PlayerType = {
				id: 'user-2',
				displayName: 'User Two',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|2',
				createdAt: new Date()
			};

			const token1 = await createSessionToken(user1);
			const token2 = await createSessionToken(user2);

			expect(token1).not.toBe(token2);
		});

		it('creates token with special characters in displayName', async () => {
			const user: PlayerType = {
				id: 'user-special',
				displayName: 'Émilie Müller 🎮',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const token = await createSessionToken(user);

			expect(token).toBeDefined();
		});
	});

	describe('verifySessionToken', () => {
		it('verifies a valid token and returns the payload', async () => {
			const user: PlayerType = {
				id: 'verify-user-123',
				displayName: 'Verify Test User',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|verify',
				createdAt: new Date()
			};

			const token = await createSessionToken(user);
			const verified = await verifySessionToken(token);

			expect(verified).toBeDefined();
			expect(verified?.sub).toBe(user.id);
			expect(verified?.displayName).toBe(user.displayName);
			expect(verified?.provider).toBe(user.authProvider);
		});

		it('verifies token for Local user', async () => {
			const user: PlayerType = {
				id: 'local-user-789',
				displayName: 'Local User',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const token = await createSessionToken(user);
			const verified = await verifySessionToken(token);

			expect(verified).toBeDefined();
			expect(verified?.sub).toBe(user.id);
			expect(verified?.provider).toBe(AuthProvider.Local);
		});

		it('returns null for invalid token', async () => {
			const invalidToken = 'not.a.valid.jwt.token';
			const verified = await verifySessionToken(invalidToken);

			expect(verified).toBeNull();
		});

		it('returns null for malformed token', async () => {
			const malformedToken = 'malformed';
			const verified = await verifySessionToken(malformedToken);

			expect(verified).toBeNull();
		});

		it('returns null for empty token', async () => {
			const verified = await verifySessionToken('');

			expect(verified).toBeNull();
		});

		it('returns null for expired token', async () => {
			vi.useFakeTimers();

			const user: PlayerType = {
				id: 'expired-user',
				displayName: 'Expired User',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|expired',
				createdAt: new Date()
			};

			const token = await createSessionToken(user);

			// Advance time beyond the expiration period
			vi.advanceTimersByTime((SESSION_MAX_AGE_SECONDS + 10) * 1000);

			const verified = await verifySessionToken(token);

			expect(verified).toBeNull();

			vi.useRealTimers();
		});

		it('preserves special characters in displayName through verification', async () => {
			const user: PlayerType = {
				id: 'special-char-user',
				displayName: 'François Müller & Søren 🎯',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const token = await createSessionToken(user);
			const verified = await verifySessionToken(token);

			expect(verified?.displayName).toBe(user.displayName);
		});
	});

	describe('createSessionToken and verifySessionToken round-trip', () => {
		it('can verify a token that was just created', async () => {
			const user: PlayerType = {
				id: 'round-trip-user',
				displayName: 'Round Trip Test',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|round',
				createdAt: new Date()
			};

			const token = await createSessionToken(user);
			const verified = await verifySessionToken(token);

			expect(verified).toBeDefined();
			expect(verified?.sub).toBe(user.id);
			expect(verified?.displayName).toBe(user.displayName);
			expect(verified?.provider).toBe(user.authProvider);
		});

		it('handles different auth providers correctly', async () => {
			const googleUser: PlayerType = {
				id: 'google-user',
				displayName: 'Google User',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|123',
				createdAt: new Date()
			};

			const localUser: PlayerType = {
				id: 'local-user',
				displayName: 'Local User',
				authProvider: AuthProvider.Local,
				authProviderId: null,
				createdAt: new Date()
			};

			const googleToken = await createSessionToken(googleUser);
			const localToken = await createSessionToken(localUser);

			const verifiedGoogle = await verifySessionToken(googleToken);
			const verifiedLocal = await verifySessionToken(localToken);

			expect(verifiedGoogle?.provider).toBe(AuthProvider.Google);
			expect(verifiedGoogle?.sub).toBe(googleUser.id);

			expect(verifiedLocal?.provider).toBe(AuthProvider.Local);
			expect(verifiedLocal?.sub).toBe(localUser.id);
		});

		it('preserves all user information through sign and verify', async () => {
			const user: PlayerType = {
				id: 'complete-user-123',
				displayName: 'Complete User Name',
				authProvider: AuthProvider.Google,
				authProviderId: 'google|complete',
				createdAt: new Date()
			};

			const token = await createSessionToken(user);
			const verified = await verifySessionToken(token);

			expect(verified).toMatchObject({
				sub: user.id,
				displayName: user.displayName,
				provider: user.authProvider
			});
		});
	});
});
