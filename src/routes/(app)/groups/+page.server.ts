import { GroupRepository } from '$lib/repositories/group';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const repo = new GroupRepository();
	const groups = await repo.getAll();
	// Serialize to JSON for frontend
	return { groups: groups.map((g) => g.toJSON()) };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('groupName')?.toString()?.trim();

		if (!name) {
			return fail(400, { error: 'Bitte einen Gruppennamen eingeben.' });
		}

		const repo = new GroupRepository();

		// TODO: Replace with current player IDs from form data or context
		await repo.create({ name }, ['1c90649b-6a45-4929-a532-eb3a4084ff6c']);

		return { success: true };
	}
};
