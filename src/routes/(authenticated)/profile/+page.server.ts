import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { PlayerRepository } from '$lib/server/repositories/player';
import { PlayerProfileSchema } from '$lib/server/db/schema';
import { requireUserOrFail } from '$lib/server/auth/guard';

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

		const { displayName } = parsed.data;

		const repo = new PlayerRepository(user.id);
		await repo.update(user.id, { displayName });

		return { success: true };
	}
};
