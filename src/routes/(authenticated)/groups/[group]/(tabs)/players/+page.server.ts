import { PlayerRepository } from '$lib/server/repositories/player';
import { GroupRepository } from '$lib/server/repositories/group';
import { fail } from '@sveltejs/kit';
import { requireUserOrFail } from '$lib/server/auth/guard';
import { signInvite } from '$lib/server/auth/invitation';
import type { Actions } from './$types';

export const actions: Actions = {
	generateInvite: async ({ params, locals, url }) => {
		const user = requireUserOrFail({ locals });

		const groupId = params.group;

		const groupRepo = new GroupRepository(user.id);
		const groupResult = await groupRepo.getById(groupId);
		if (!groupResult.ok) {
			return fail(groupResult.status, { error: groupResult.error });
		}
		const group = groupResult.value;

		const token = await signInvite({ groupId: groupId, groupName: group.name });

		// Build invite URL pointing to /invite?t=TOKEN
		const base = url?.origin ?? '';
		const inviteUrl = `${base}/groups/${groupId}/join?t=${encodeURIComponent(token)}`;

		return { success: true, inviteUrl };
	},

	// Current user leaves the group
	leave: async ({ params, locals }) => {
		const user = requireUserOrFail({ locals });
		const groupId = params.group;

		const groupRepo = new GroupRepository(user.id);
		const leaveResult = await groupRepo.leave(groupId);
		if (!leaveResult.ok) {
			return fail(leaveResult.status, { error: leaveResult.error });
		}
		return { success: true, leftGroup: true, deletedGroup: leaveResult.value.deletedGroup };
	},

	createLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerName = formData.get('playerName');

		const groupId = params.group;

		const playerRepo = new PlayerRepository(user.id);
		const createResult = await playerRepo.createLocal((playerName ?? '').toString(), groupId);
		if (!createResult.ok) {
			return fail(createResult.status, { error: createResult.error });
		}

		return { success: true };
	},

	removeLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;

		if (!playerId) {
			return fail(400, { error: 'Spieler ID fehlt.' });
		}

		const groupId = params.group;
		const playerRepo = new PlayerRepository(user.id);
		const removal = await playerRepo.deleteLocal(playerId, groupId);
		if (!removal.ok) {
			return fail(removal.status, { error: removal.error });
		}

		return { success: true };
	},

	renameLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;
		const newDisplayName = (formData.get('displayName') as string)?.trim();

		const groupId = params.group;
		const playerRepo = new PlayerRepository(user.id);
		const renameResult = await playerRepo.renameLocal(playerId, groupId, newDisplayName ?? '');
		if (!renameResult.ok) {
			return fail(renameResult.status, {
				error: renameResult.error,
				values: { displayName: newDisplayName }
			});
		}

		return { success: true };
	},

	takeoverLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const localPlayerId = formData.get('localPlayerId') as string;

		if (!localPlayerId) {
			return fail(400, { error: 'Daten fehlen.' });
		}

		const playerRepo = new PlayerRepository(user.id);
		const takeover = await playerRepo.takeoverLocalPlayer(localPlayerId, params.group!);
		if (!takeover.ok) {
			return fail(takeover.status, { error: takeover.error });
		}
		return { success: true };
	}
};
