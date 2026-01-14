import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrRedirectToLogin, requireUserOrFail } from '$lib/server/auth/guard';
import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const repo = new GroupRepository(user.id);
	const groups = await repo.list();
	return { groups };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const repo = new GroupRepository(user.id);
		const createResult = await repo.create((formData.get('groupName') ?? '').toString());
		if (!createResult.ok) {
			return fail(createResult.status, {
				error: createResult.error,
				values: { groupName: formData.get('groupName') ?? '' }
			});
		}

		return { success: true, groupId: createResult.value.id };
	}
};
