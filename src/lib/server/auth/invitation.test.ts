import { describe, expect, it, vi } from 'vitest';
import { signInvite, verifyInvite, INVITATION_MAX_AGE_SECONDS } from './invitation';

describe('Invitation', () => {
	describe('signInvite', () => {
		it('creates a JWT token for a group invitation', async () => {
			const payload = {
				groupId: 'group-123',
				groupName: 'Test Group'
			};

			const token = await signInvite(payload);

			expect(token).toBeDefined();
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});

		it('creates different tokens for different payloads', async () => {
			const payload1 = { groupId: 'group-1', groupName: 'Group One' };
			const payload2 = { groupId: 'group-2', groupName: 'Group Two' };

			const token1 = await signInvite(payload1);
			const token2 = await signInvite(payload2);

			expect(token1).not.toBe(token2);
		});
	});

	describe('verifyInvite', () => {
		it('verifies a valid token and returns the payload', async () => {
			const payload = {
				groupId: 'group-456',
				groupName: 'Another Group'
			};

			const token = await signInvite(payload);
			const verified = await verifyInvite(token);

			expect(verified).toBeDefined();
			expect(verified).toMatchObject(payload);
			expect(verified?.iat).toBeDefined(); // issued at timestamp
			expect(verified?.exp).toBeDefined(); // expiration timestamp
		});

		it('returns null for invalid token', async () => {
			const invalidToken = 'not.a.valid.jwt.token';
			const verified = await verifyInvite(invalidToken);

			expect(verified).toBeNull();
		});

		it('returns null for malformed token', async () => {
			const malformedToken = 'malformed';
			const verified = await verifyInvite(malformedToken);

			expect(verified).toBeNull();
		});

		it('returns null for empty token', async () => {
			const verified = await verifyInvite('');

			expect(verified).toBeNull();
		});

		it('verifies token contains expected expiration time', async () => {
			const payload = { groupId: 'group-789', groupName: 'Expiry Test Group' };
			const beforeSign = Math.floor(Date.now() / 1000);

			const token = await signInvite(payload);
			const verified = await verifyInvite(token);

			expect(verified).toBeDefined();
			expect(verified?.exp).toBeDefined();
			if (verified?.exp) {
				const expectedExp = beforeSign + INVITATION_MAX_AGE_SECONDS;
				// Allow 2 second tolerance for test execution time
				expect(verified.exp).toBeGreaterThanOrEqual(expectedExp - 2);
				expect(verified.exp).toBeLessThanOrEqual(expectedExp + 2);
			}
		});

		it('returns null for expired token', async () => {
			vi.useFakeTimers();
			const payload = { groupId: 'expired-group', groupName: 'Expired Group' };

			const token = await signInvite(payload);

			// Advance time beyond the expiration period
			vi.advanceTimersByTime((INVITATION_MAX_AGE_SECONDS + 10) * 1000);

			const verified = await verifyInvite(token);

			expect(verified).toBeNull();

			vi.useRealTimers();
		});
	});

	describe('signInvite and verifyInvite round-trip', () => {
		it('can verify a token that was just signed', async () => {
			const payload = {
				groupId: 'round-trip-group',
				groupName: 'Round Trip Test'
			};

			const token = await signInvite(payload);
			const verified = await verifyInvite(token);

			expect(verified).toBeDefined();
			expect(verified?.groupId).toBe(payload.groupId);
			expect(verified?.groupName).toBe(payload.groupName);
		});

		it('preserves all payload fields through sign and verify', async () => {
			const payload = {
				groupId: 'abc-123-def-456',
				groupName: 'Special Characters & Emoji 🎮'
			};

			const token = await signInvite(payload);
			const verified = await verifyInvite(token);

			expect(verified).toMatchObject(payload);
		});
	});
});
