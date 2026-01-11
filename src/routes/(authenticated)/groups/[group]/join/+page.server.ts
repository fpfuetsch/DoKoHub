import type { Actions } from './$types';
import { verifyInvite } from '$lib/server/auth/invitation';
import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrFail, requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { redirect, fail } from '@sveltejs/kit';

export async function load({ url, params, locals }) {
	const user = requireUserOrRedirectToLogin({ locals, url });

	const token = url.searchParams.get('t');
	if (!token) return { valid: false };

	const payload = await verifyInvite(token);
	if (!payload || !payload.groupId) return { valid: false };

	// ensure token's group matches the route param
	if (String(payload.groupId) !== params.group) return { valid: false };

	// check if already member
	const groupRepo = new GroupRepository(user.id);
	const group = await groupRepo.getById(String(payload.groupId));
	if (group) {
		// already member - redirect to group page
		throw redirect(303, `/groups/${payload.groupId}/`);
	}

	return { valid: true, groupId: payload.groupId, groupName: payload.groupName, token };
}

export const actions: Actions = {
	accept: async (event) => {
		const user = requireUserOrFail({ locals: event.locals });

		const form = await event.request.formData();
		const token = form.get('token') as string;
		if (!token) return fail(400, { error: 'Kein Token' });

		const payload = await verifyInvite(token);
		if (!payload || !payload.groupId)
			return fail(400, { error: 'Ungültige oder abgelaufene Einladung.' });

		const groupId = payload.groupId as string;
		if (groupId !== event.params.group)
			return fail(400, { error: 'Invite gehört zu einer anderen Gruppe.' });

		const groupRepo = new GroupRepository(user.id);
		const success = await groupRepo.addMember(groupId, user.id, true);
		if (!success) return fail(400, { error: 'Fehler beim Beitreten der Gruppe,' });

		// Redirect to group page
		throw redirect(303, `/groups/${groupId}`);
	}
};
