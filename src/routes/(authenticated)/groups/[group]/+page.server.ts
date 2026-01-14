import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load: PageServerLoad = async ({ params }) => {
	throw redirect(302, `/groups/${params.group}/games`);
};

export const actions: Actions = {
	rename: async ({ request, locals, params }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const newName = formData.get('name')?.toString() || '';
		const groupId = params.group!;

		const repo = new GroupRepository(user.id);
		const updated = await repo.rename(groupId, newName);
		if (!updated.ok) {
			return fail(updated.status, { error: updated.error });
		}
		return { success: true };
	},
	delete: async ({ locals, params }) => {
		const user = requireUserOrFail({ locals });
		const groupId = params.group!;

		const repo = new GroupRepository(user.id);
		const deleted = await repo.delete(groupId);
		if (!deleted.ok) {
			return fail(deleted.status, { error: deleted.error });
		}
		return { success: true };
	}
};
