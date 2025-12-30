import { Google, generateCodeVerifier, generateState } from 'arctic';
import { env } from '$env/dynamic/private';

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
	throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

export const GOOGLE_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_VERIFIER_COOKIE = 'google_oauth_verifier';
export const GOOGLE_REDIRECT_COOKIE = 'google_oauth_redirect';

export const createGoogleProvider = (redirectUri: string) =>
	new Google(env.GOOGLE_CLIENT_ID!, env.GOOGLE_CLIENT_SECRET!, redirectUri);

export { generateCodeVerifier, generateState };
