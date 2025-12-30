import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '$env/dynamic/private';
import { sessionCookieAttributes } from './session';

const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET ?? 'dev-secret-change-me');
export const ONBOARDING_COOKIE = 'doko_onboarding';
const MAX_AGE_SECONDS = 10 * 60; // 10 minutes

export type OnboardingPayload = {
	provider: 'google';
	providerId: string;
	suggestedName: string;
	suggestedDisplayName: string;
	redirectTo?: string;
};

export async function createOnboardingToken(payload: OnboardingPayload): Promise<string> {
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(`${MAX_AGE_SECONDS}s`)
		.sign(secret);
}

export async function verifyOnboardingToken(token: string): Promise<OnboardingPayload | null> {
	try {
		const result = await jwtVerify<JWTPayload>(token, secret, { algorithms: ['HS256'] });
		return {
			provider: result.payload.provider as OnboardingPayload['provider'],
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
	maxAge: MAX_AGE_SECONDS
};
