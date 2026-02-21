import { error, redirect } from '@sveltejs/kit';
import { decodeJwt } from 'jose';
import {
	GOOGLE_REDIRECT_COOKIE,
	GOOGLE_STATE_COOKIE,
	GOOGLE_VERIFIER_COOKIE,
	createGoogleProvider
} from '$lib/server/auth/google';
import {
	SESSION_COOKIE_NAME,
	createSessionToken,
	sessionCookieAttributes
} from '$lib/server/auth/session';
import {
	ONBOARDING_COOKIE,
	createOnboardingToken,
	onboardingCookieAttributes
} from '$lib/server/auth/onboarding';
import { PlayerRepository } from '$lib/server/repositories/player';
import { AuthProvider } from '$lib/server/enums';
import { getSafeRedirectUrl } from '$lib/server/auth/redirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const storedState = cookies.get(GOOGLE_STATE_COOKIE);
	const codeVerifier = cookies.get(GOOGLE_VERIFIER_COOKIE);
	const redirectCookie = cookies.get(GOOGLE_REDIRECT_COOKIE);

	cookies.delete(GOOGLE_STATE_COOKIE, { path: '/' });
	cookies.delete(GOOGLE_VERIFIER_COOKIE, { path: '/' });
	cookies.delete(GOOGLE_REDIRECT_COOKIE, { path: '/' });

	if (!state || !code || !storedState || !codeVerifier || state !== storedState) {
		throw redirect(302, '/login?error=oauth_state');
	}

	const provider = createGoogleProvider(`${url.origin}/login/google/callback`);
	const tokens = await provider.validateAuthorizationCode(code, codeVerifier);

	// Decode ID token to extract user info (already signed and verified by Arctic)
	const idTokenDecoded = decodeJwt(tokens.idToken());

	if (!idTokenDecoded.sub) throw error(400, 'Missing Google user id.');
	const playerRepo = new PlayerRepository();
	const existing = await playerRepo.getByProvider(
		AuthProvider.Google,
		idTokenDecoded.sub as string
	);

	if (!existing) {
		// SECURITY: Validate redirect URL to prevent open redirects
		const rawRedirectTo = redirectCookie ?? url.searchParams.get('redirectTo');
		const safeRedirectTo = getSafeRedirectUrl(rawRedirectTo);

		const onboardingToken = await createOnboardingToken({
			provider: AuthProvider.Google,
			providerId: idTokenDecoded.sub,
			suggestedName: ((idTokenDecoded.name as string) || '').toLowerCase(),
			suggestedDisplayName: (
				((idTokenDecoded.given_name as string) || '') +
				' ' +
				((idTokenDecoded.family_name as string) || '')
			).trim(),
			redirectTo: safeRedirectTo
		});

		cookies.set(ONBOARDING_COOKIE, onboardingToken, onboardingCookieAttributes);
		cookies.delete(SESSION_COOKIE_NAME, { path: sessionCookieAttributes.path });
		throw redirect(302, '/onboarding');
	}

	const token = await createSessionToken(existing);
	cookies.set(SESSION_COOKIE_NAME, token, sessionCookieAttributes);
	cookies.delete(ONBOARDING_COOKIE, { path: onboardingCookieAttributes.path });

	// SECURITY: Validate the redirect URL
	const rawRedirectTo = redirectCookie ?? url.searchParams.get('redirectTo');
	const safeRedirectTo = getSafeRedirectUrl(rawRedirectTo);
	throw redirect(302, safeRedirectTo);
};
