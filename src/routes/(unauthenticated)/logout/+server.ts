import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, sessionCookieAttributes } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete(SESSION_COOKIE_NAME, { path: sessionCookieAttributes.path });
	throw redirect(302, '/login');
};
