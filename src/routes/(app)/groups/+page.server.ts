import { GroupRepository } from '$lib/repositories/group';
import { GroupInsertSchema } from '$lib/server/db/schema';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const repo = new GroupRepository();
	const groups = await repo.getAll();
	return { groups: groups };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();

		const parsed = GroupInsertSchema.safeParse({
			name: formData.get('groupName')
		});

		if (!parsed.success) {
			return fail(400, { error: 'Bitte einen Gruppennamen eingeben.', });
		}

		const repo = new GroupRepository();

		// TODO: Replace with current player IDs from form data or context
		await repo.create({ name: parsed.data.name }, ['1c90649b-6a45-4929-a532-eb3a4084ff6c']);

		return { success: true };
	}
};
