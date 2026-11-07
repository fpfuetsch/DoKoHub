import { Google, generateCodeVerifier, generateState } from 'arctic';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$app/env/private';

export const GOOGLE_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_VERIFIER_COOKIE = 'google_oauth_verifier';
export const GOOGLE_REDIRECT_COOKIE = 'google_oauth_redirect';
export const createGoogleProvider = (redirectUri: string) =>
	new Google(GOOGLE_CLIENT_ID!, GOOGLE_CLIENT_SECRET!, redirectUri);
export { generateCodeVerifier, generateState };
