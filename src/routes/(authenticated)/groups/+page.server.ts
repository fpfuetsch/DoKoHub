import { GroupRepository } from '$lib/repositories/group';
import { GroupInsertSchema } from '$lib/server/db/schema';
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

		const parsed = GroupInsertSchema.safeParse({
			name: formData.get('groupName')
		});

		if (!parsed.success) {
			return fail(400, { error: 'Bitte einen Gruppennamen eingeben.', });
		}

		const repo = new GroupRepository(user.id);
		await repo.create({ name: parsed.data.name });

		return { success: true };
	}
};
