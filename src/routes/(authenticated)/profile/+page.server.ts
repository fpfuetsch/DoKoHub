import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PlayerRepository } from '$lib/repositories/player';
import { PlayerProfileSchema } from '$lib/server/db/schema';
import { requireUserOrRedirectToLogin, requireUserOrFail } from '$lib/server/auth/guard';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	return { user };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUserOrFail({ locals });

		const formData = Object.fromEntries(await request.formData());
		const parsed = PlayerProfileSchema.safeParse(formData);
		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: formData
			});
		}

		const { name, displayName } = parsed.data;

		const repo = new PlayerRepository(user.id);
		const nameOwner = await repo.getByName(name);
		if (nameOwner && nameOwner.id !== user.id) {
			return fail(409, {
				message: 'Dieser Benutzername ist bereits vergeben.',
				values: parsed.data
			});
		}

		await repo.update(user.id, { name, displayName });

		throw redirect(303, '/profile?updated=1');
	}
};