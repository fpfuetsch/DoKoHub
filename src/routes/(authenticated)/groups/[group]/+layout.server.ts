import { GroupRepository } from '$lib/repositories/group';
import type { LayoutServerLoad } from './$types';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const repo = new GroupRepository(user.id);
	return { group: await repo.getById(params.group) };
};
