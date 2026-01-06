import { GroupRepository } from '$lib/server/repositories/group';
import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });

	const repo = new GroupRepository(user.id);
	const group = await repo.getById(params.group);
	if (!group) {
		throw error(404, 'Gruppe nicht gefunden');
	}
	return { group, user };
};
