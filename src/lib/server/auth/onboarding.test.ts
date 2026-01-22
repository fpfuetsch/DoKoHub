import { describe, expect, it, vi } from 'vitest';
import {
	createOnboardingToken,
	verifyOnboardingToken,
	ONBOARDING_MAX_AGE_SECONDS,
	type OnboardingPayload
} from './onboarding';
import { AuthProvider } from '$lib/server/enums';

describe('Onboarding', () => {
	describe('createOnboardingToken', () => {
		it('creates a JWT token for onboarding with minimal payload', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|123456'
			};

			const token = await createOnboardingToken(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('creates a JWT token with all optional fields', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Local,
				providerId: 'local|789',
				suggestedName: 'john.doe',
				suggestedDisplayName: 'John Doe',
				redirectTo: '/dashboard'
			};

			const token = await createOnboardingToken(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
		});

		it('creates different tokens for different payloads', async () => {
			const payload1: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|111'
			};
			const payload2: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|222'
			};

			const token1 = await createOnboardingToken(payload1);
			const token2 = await createOnboardingToken(payload2);

			expect(token1).not.toBe(token2);
		});
	});

	describe('verifyOnboardingToken', () => {
		it('verifies a valid token and returns the payload with minimal fields', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|verify-test'
			};

			const token = await createOnboardingToken(payload);
			const verified = await verifyOnboardingToken(token);

			expect(verified).toBeDefined();
			expect(verified?.provider).toBe(payload.provider);
			expect(verified?.providerId).toBe(payload.providerId);
			expect(verified?.suggestedName).toBeUndefined();
			expect(verified?.suggestedDisplayName).toBeUndefined();
			expect(verified?.redirectTo).toBeUndefined();
		});

		it('verifies a valid token with all optional fields', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Local,
				providerId: 'local|full-test',
				suggestedName: 'jane.smith',
				suggestedDisplayName: 'Jane Smith',
				redirectTo: '/groups/abc-123'
			};

			const token = await createOnboardingToken(payload);
			const verified = await verifyOnboardingToken(token);

			expect(verified).toBeDefined();
			expect(verified?.provider).toBe(payload.provider);
			expect(verified?.providerId).toBe(payload.providerId);
			expect(verified?.suggestedName).toBe(payload.suggestedName);
			expect(verified?.suggestedDisplayName).toBe(payload.suggestedDisplayName);
			expect(verified?.redirectTo).toBe(payload.redirectTo);
		});

		it('returns null for invalid token', async () => {
			const invalidToken = 'not.a.valid.jwt.token';
			const verified = await verifyOnboardingToken(invalidToken);

			expect(verified).toBeNull();
		});

		it('returns null for malformed token', async () => {
			const malformedToken = 'malformed';
			const verified = await verifyOnboardingToken(malformedToken);

			expect(verified).toBeNull();
		});

		it('returns null for empty token', async () => {
			const verified = await verifyOnboardingToken('');

			expect(verified).toBeNull();
		});

		it('returns null for expired token', async () => {
			vi.useFakeTimers();

			const payload: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|expired'
			};

			const token = await createOnboardingToken(payload);

			// Advance time beyond the expiration period
			vi.advanceTimersByTime((ONBOARDING_MAX_AGE_SECONDS + 10) * 1000);

			const verified = await verifyOnboardingToken(token);

			expect(verified).toBeNull();

			vi.useRealTimers();
		});

		it('verifies token with special characters in fields', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Local,
				providerId: 'provider|special-chars-123',
				suggestedDisplayName: 'User with Émojis 🎮 & Special Çhars',
				redirectTo: '/groups/test?tab=games&sort=name'
			};

			const token = await createOnboardingToken(payload);
			const verified = await verifyOnboardingToken(token);

			expect(verified).toBeDefined();
			expect(verified?.suggestedDisplayName).toBe(payload.suggestedDisplayName);
			expect(verified?.redirectTo).toBe(payload.redirectTo);
		});
	});

	describe('createOnboardingToken and verifyOnboardingToken round-trip', () => {
		it('can verify a token that was just created', async () => {
			const payload: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|round-trip',
				suggestedDisplayName: 'Round Trip User',
				redirectTo: '/onboarding/complete'
			};

			const token = await createOnboardingToken(payload);
			const verified = await verifyOnboardingToken(token);

			expect(verified).toBeDefined();
			expect(verified?.provider).toBe(payload.provider);
			expect(verified?.providerId).toBe(payload.providerId);
			expect(verified?.suggestedDisplayName).toBe(payload.suggestedDisplayName);
			expect(verified?.redirectTo).toBe(payload.redirectTo);
		});

		it('handles different auth providers correctly', async () => {
			const googlePayload: OnboardingPayload = {
				provider: AuthProvider.Google,
				providerId: 'google|123'
			};
			const localPayload: OnboardingPayload = {
				provider: AuthProvider.Local,
				providerId: 'local|456'
			};

			const googleToken = await createOnboardingToken(googlePayload);
			const localToken = await createOnboardingToken(localPayload);

			const verifiedGoogle = await verifyOnboardingToken(googleToken);
			const verifiedLocal = await verifyOnboardingToken(localToken);

			expect(verifiedGoogle?.provider).toBe(AuthProvider.Google);
			expect(verifiedLocal?.provider).toBe(AuthProvider.Local);
		});
	});
});
