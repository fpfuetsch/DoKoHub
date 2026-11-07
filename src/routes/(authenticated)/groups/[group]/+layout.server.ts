import { GroupRepository } from '#lib/server/repositories/group.js';
import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requireUserOrRedirectToLogin } from '#lib/server/auth/guard.js';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });

	const repo = new GroupRepository(user.id);
	const groupResult = await repo.getById(params.group);
	if (!groupResult.ok) {
		throw error(groupResult.status, groupResult.error);
	}
	return { group: groupResult.value, user };
};
