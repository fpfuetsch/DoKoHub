import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '$env/dynamic/private';
import { sessionCookieAttributes } from './session';
import type { AuthProviderType } from '$lib/server/enums';

const rawOnboardingSecret = env.AUTH_JWT_SECRET ?? 'dev-secret-change-me';
const secret = new TextEncoder().encode(rawOnboardingSecret);
export const ONBOARDING_COOKIE = 'dokohub_onboarding';
export const ONBOARDING_MAX_AGE_SECONDS = env.ONBOARDING_MAX_AGE_SECONDS ? parseInt(env.ONBOARDING_MAX_AGE_SECONDS) : 15 * 60; // default: 15 minutes

export type OnboardingPayload = {
	provider: AuthProviderType;
	providerId: string;
	suggestedName?: string;
	suggestedDisplayName?: string;
	redirectTo?: string;
};

export async function createOnboardingToken(payload: OnboardingPayload): Promise<string> {
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(`${ONBOARDING_MAX_AGE_SECONDS}s`)
		.sign(secret);
}

export async function verifyOnboardingToken(token: string): Promise<OnboardingPayload | null> {
	try {
		const result = await jwtVerify<JWTPayload>(token, secret, { algorithms: ['HS256'] });
		return {
			provider: result.payload.provider as AuthProviderType,
			providerId: result.payload.providerId as string,
			suggestedName: result.payload.suggestedName as string | undefined,
			suggestedDisplayName: result.payload.suggestedDisplayName as string | undefined,
			redirectTo: result.payload.redirectTo as string | undefined
		};
	} catch (error) {
		return null;
	}
}

export const onboardingCookieAttributes = {
	...sessionCookieAttributes,
	maxAge: ONBOARDING_MAX_AGE_SECONDS
};
