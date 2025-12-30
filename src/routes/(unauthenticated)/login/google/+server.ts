import { redirect } from '@sveltejs/kit';
import {
	GOOGLE_REDIRECT_COOKIE,
	GOOGLE_STATE_COOKIE,
	GOOGLE_VERIFIER_COOKIE,
	createGoogleProvider,
	generateCodeVerifier,
	generateState
} from '$lib/server/auth/google';
import { sessionCookieAttributes } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

const temporaryCookieOptions = {
	...sessionCookieAttributes,
	maxAge: 600
};

export const GET: RequestHandler = async ({ cookies, url }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const redirectUri = `${url.origin}/login/google/callback`;
	const provider = createGoogleProvider(redirectUri);
	const authorizationUrl = await provider.createAuthorizationURL(state, codeVerifier, {
		scopes: ['openid', 'profile']
	});

	const redirectTo = url.searchParams.get('redirectTo');

	cookies.set(GOOGLE_STATE_COOKIE, state, temporaryCookieOptions);
	cookies.set(GOOGLE_VERIFIER_COOKIE, codeVerifier, temporaryCookieOptions);
	if (redirectTo) {
		cookies.set(GOOGLE_REDIRECT_COOKIE, redirectTo, temporaryCookieOptions);
	}

	throw redirect(302, authorizationUrl.toString());
};
