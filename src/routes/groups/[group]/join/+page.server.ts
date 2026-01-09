import type { Actions } from './$types';
import { verifyInvite } from '$lib/server/invite';
import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { redirect, fail } from '@sveltejs/kit';

export async function load({ params, url }) {
  const token = url.searchParams.get('t');
  if (!token) return { valid: false };
  const payload = await verifyInvite(token);
  if (!payload || !payload.groupId) return { valid: false };
  // Ensure token group matches the route
  if (String(payload.groupId) !== params.group) return { valid: false };
  return { valid: true, groupId: payload.groupId, token };
}

export const actions: Actions = {
  accept: async (event) => {
    const user = requireUserOrRedirectToLogin({ locals: event.locals, url: event.url });

    const form = await event.request.formData();
    const token = form.get('token') as string;
    if (!token) return fail(400, { error: 'Kein Token' });

    const payload = await verifyInvite(token);
    if (!payload || !payload.groupId) return fail(400, { error: 'Ungültiges oder abgelaufenes Invite' });

    const groupId = payload.groupId as string;
    // ensure route group matches payload
    if (groupId !== event.params.group) return fail(400, { error: 'Invite passt nicht zur Gruppe' });

    const groupRepo = new GroupRepository(user.id);
    const added = await groupRepo.addMember(groupId, user.id, true);
    if (!added) return fail(403, { error: 'Nicht berechtigt, beizutreten.' });

    throw redirect(303, `/groups/${groupId}`);
  }
};
