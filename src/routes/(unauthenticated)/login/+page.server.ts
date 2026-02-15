import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSafeRedirectUrl } from '$lib/server/auth/redirect';

export const load: PageServerLoad = async ({ locals, url }) => {
	const rawRedirectTo = url.searchParams.get('redirectTo');

	// SECURITY: Validate redirect URL to prevent open redirects
	const redirectTo = getSafeRedirectUrl(rawRedirectTo);

	if (locals.user) {
		throw redirect(302, redirectTo);
	}

	return { redirectTo };
};
