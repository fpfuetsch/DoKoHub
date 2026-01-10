import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PlayerRepository } from '$lib/server/repositories/player';
import { PlayerProfileSchema, PlayerDisplayNameSchema } from '$lib/server/db/schema';
import {
	ONBOARDING_COOKIE,
	onboardingCookieAttributes,
	verifyOnboardingToken
} from '$lib/server/auth/onboarding';
import {
	SESSION_COOKIE_NAME,
	createSessionToken,
	sessionCookieAttributes
} from '$lib/server/auth/session';
import { AuthProvider } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user) throw redirect(302, '/groups');

	const onboarding = cookies.get(ONBOARDING_COOKIE);
	const payload = onboarding ? await verifyOnboardingToken(onboarding) : null;
	if (!payload) {
		cookies.delete(ONBOARDING_COOKIE, { path: onboardingCookieAttributes.path });
		throw redirect(302, '/login');
	}

	const suggestedDisplayName = payload.suggestedDisplayName
		? PlayerDisplayNameSchema.safeParse(payload.suggestedDisplayName).success
			? payload.suggestedDisplayName
			: ''
		: '';

	return {
		defaults: {
			displayName: suggestedDisplayName
		}
	};
};

export const actions: Actions = {
	save: async ({ request, cookies }) => {
		const onboarding = cookies.get(ONBOARDING_COOKIE);
		const payload = onboarding ? await verifyOnboardingToken(onboarding) : null;
		if (!payload) {
			cookies.delete(ONBOARDING_COOKIE, { path: onboardingCookieAttributes.path });
			return fail(401, { message: 'Anmeldung abgelaufen. Bitte erneut anmelden.' });
		}

		const formData = Object.fromEntries(await request.formData());
		const parsed = PlayerProfileSchema.safeParse(formData);
		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: formData
			});
		}

			const { displayName } = parsed.data;
			const playerRepository = new PlayerRepository();

			const player = await playerRepository.create({
				displayName,
				authProvider: payload.provider as AuthProvider,
				authProviderId: payload.providerId
			});

		const token = await createSessionToken({
			id: player.id,
			displayName: player.displayName,
			authProvider: player.authProvider,
			authProviderId: player.authProviderId,
			createdAt: player.createdAt
		});
		cookies.set(SESSION_COOKIE_NAME, token, sessionCookieAttributes);
		cookies.delete(ONBOARDING_COOKIE, { path: onboardingCookieAttributes.path });

		throw redirect(303, payload.redirectTo ?? '/groups');
	}
};
