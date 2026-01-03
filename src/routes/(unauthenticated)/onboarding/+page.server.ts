import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PlayerRepository } from '$lib/repositories/player';
import { PlayerProfileSchema, PlayerNameSchema, PlayerDisplayNameSchema } from '$lib/server/db/schema';
import {
	ONBOARDING_COOKIE,
	onboardingCookieAttributes,
	verifyOnboardingToken
} from '$lib/server/auth/onboarding';
import { SESSION_COOKIE_NAME, createSessionToken, sessionCookieAttributes } from '$lib/server/auth/session';
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

	const suggestedName = payload.suggestedName
		? PlayerNameSchema.safeParse(payload.suggestedName).success
			? payload.suggestedName
			: ''
		: '';

	return {
		defaults: {
			displayName: suggestedDisplayName,
			name: suggestedName
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

		const { name, displayName } = parsed.data;
		const playerRepository = new PlayerRepository();

		const nameOwner = await playerRepository.getByName(name);
		if (nameOwner) {
			return fail(409, {
				message: 'Dieser Benutzername ist bereits vergeben.',
				values: parsed.data
			});
		}

		const player = await playerRepository.create({
			name,
			displayName,
			authProvider: payload.provider as AuthProvider,
			authProviderId: payload.providerId
		});

		const token = await createSessionToken({
			id: player.id,
			name: player.name,
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
