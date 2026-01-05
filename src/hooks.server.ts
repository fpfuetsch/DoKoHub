import type { Handle } from '@sveltejs/kit';
import { PlayerRepository } from '$lib/server/repositories/player';
import {
	SESSION_COOKIE_NAME,
	sessionCookieAttributes,
	verifySessionToken
} from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME);

	if (token) {
		const payload = await verifySessionToken(token);
		if (payload) {
			const repo = new PlayerRepository();
			const player = await repo.getById(payload.sub);

			if (player) {
				event.locals.user = player;
			} else {
				event.locals.user = null;
				event.cookies.delete(SESSION_COOKIE_NAME, { path: sessionCookieAttributes.path });
			}
		} else {
			event.locals.user = null;
			event.cookies.delete(SESSION_COOKIE_NAME, { path: sessionCookieAttributes.path });
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
