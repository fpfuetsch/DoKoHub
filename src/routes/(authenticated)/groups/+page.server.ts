import { GroupRepository } from '$lib/server/repositories/group';
import { GroupNameSchema } from '$lib/server/db/schema';
import { requireUserOrRedirectToLogin, requireUserOrFail } from '$lib/server/auth/guard';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

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
		const groupName = formData.get('groupName');

		if (typeof groupName !== 'string') {
			return fail(400, {
				error: 'Bitte einen gültigen Gruppennamen eingeben.',
				values: { groupName: '' }
			});
		}

		const parsed = GroupNameSchema.safeParse(groupName);

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message || 'Bitte einen gültigen Gruppennamen eingeben.',
				values: { groupName }
			});
		}

		const repo = new GroupRepository(user.id);
		const group = await repo.create({ name: parsed.data });

		return { success: true, groupId: group.id };
	}
};
