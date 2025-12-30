import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PlayerRepository } from '$lib/repositories/player';
import { z } from 'zod';

const profileSchema = z.object({
	displayName: z.string().trim().min(2, 'Mindestens 2 Zeichen').max(80, 'Maximal 80 Zeichen'),
	name: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^[a-z0-9_-]+$/, 'Nur Kleinbuchstaben, Zahlen, - und _')
		.min(3, 'Mindestens 3 Zeichen')
		.max(40, 'Maximal 40 Zeichen')
});

export const load: PageServerLoad = async ({ locals }) => {
	return { user: locals.user };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Nicht angemeldet' });

		const formData = Object.fromEntries(await request.formData());
		const parsed = profileSchema.safeParse(formData);
		if (!parsed.success) {
			return fail(400, {
				errors: parsed.error.flatten().fieldErrors,
				values: formData
			});
		}

		const { name, displayName } = parsed.data;

		const repo = new PlayerRepository();
		const nameOwner = await repo.getByName(name);
		if (nameOwner && nameOwner.id !== locals.user.id) {
			return fail(409, {
				message: 'Dieser Benutzername ist bereits vergeben.',
				values: parsed.data
			});
		}

		await repo.update(locals.user.id, { name, displayName });

		throw redirect(303, '/profile?updated=1');
	}
};