import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { PlayerType } from '$lib/server/db/schema';
import type { AuthProviderType } from '$lib/server/enums';

const DEFAULT_JWT_SECRET = 'dev-secret-change-me';
const rawJwtSecret = env.AUTH_JWT_SECRET ?? DEFAULT_JWT_SECRET;
if (rawJwtSecret === DEFAULT_JWT_SECRET) {
	// eslint-disable-next-line no-console
	console.warn('WARNING: Using default JWT secret. Set AUTH_JWT_SECRET in env for production.');
}
const jwtAuthSecret = new TextEncoder().encode(rawJwtSecret);
const issuer = 'dokohub';
const audience = 'dokohub:web';

export const SESSION_COOKIE_NAME = 'dokohub';
export const SESSION_MAX_AGE_SECONDS = env.SESSION_MAX_AGE_SECONDS ? parseInt(env.SESSION_MAX_AGE_SECONDS) : 7 * 24 * 60 * 60; // default: 7 days

export type SessionTokenPayload = {
	sub: string;
	displayName: string;
	name: string;
	provider: AuthProviderType;
};

export async function createSessionToken(user: PlayerType): Promise<string> {
	return await new SignJWT({
		displayName: user.displayName,
		name: user.name,
		provider: user.authProvider
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(user.id)
		.setIssuer(issuer)
		.setAudience(audience)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
		.sign(jwtAuthSecret);
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
	try {
		const result = await jwtVerify<JWTPayload>(token, jwtAuthSecret, { issuer, audience });
		if (!result.payload.sub) return null;
		return {
			sub: result.payload.sub as string,
			displayName: (result.payload.displayName as string) ?? '',
			name: (result.payload.name as string) ?? '',
			provider: result.payload.provider as AuthProviderType
		};
	} catch (error) {
		return null;
	}
}

export const sessionCookieAttributes = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: SESSION_MAX_AGE_SECONDS
};
