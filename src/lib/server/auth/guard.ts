import { fail, redirect } from '@sveltejs/kit';

export type AuthenticatedUser = NonNullable<App.Locals['user']>;

export function requireUserOrRedirectToLogin(event: {
	locals: App.Locals;
	url: URL;
}): AuthenticatedUser {
	if (!event.locals.user) {
		const redirectTo = encodeURIComponent(event.url.pathname + event.url.search);
		throw redirect(302, `/login?redirectTo=${redirectTo}`);
	}
	return event.locals.user;
}

export function requireUserOrFail(event: { locals: App.Locals }): AuthenticatedUser {
	if (!event.locals.user) {
		throw fail(401, { error: 'Unauthorized' });
	}
	return event.locals.user;
}
