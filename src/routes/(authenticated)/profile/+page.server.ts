import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { PlayerRepository } from '$lib/server/repositories/player';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUserOrFail({ locals });

		const formData = await request.formData();
		const displayName = (formData.get('displayName') ?? '').toString();

		const repo = new PlayerRepository(user.id);
		const result = await repo.rename(displayName);
		if (!result.ok) {
			return fail(result.status, {
				errors: [result.error],
				values: { displayName }
			});
		}

		return { success: true };
	}
};
