import { PlayerRepository } from '$lib/server/repositories/player';
import { GroupRepository } from '$lib/server/repositories/group';
import { fail } from '@sveltejs/kit';
import { requireUserOrFail } from '$lib/server/auth/guard';
import { AuthProvider } from '$lib/server/enums';
import type { Actions } from './$types';

export const actions: Actions = {
	addExisting: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();

		if (!username) {
			return fail(400, { error: 'Bitte einen Benutzernamen eingeben.' });
		}

		const groupId = params.group;

		// Look up player by username
		const playerRepo = new PlayerRepository(user.id);
		const player = await playerRepo.getByName(username);

		if (!player) {
			return fail(404, { error: 'Spieler mit diesem Benutzernamen nicht gefunden.' });
		}

		if (player.authProvider === AuthProvider.Local) {
			return fail(400, {
				error: 'Lokale Spieler können nicht auf diese Weise hinzugefügt werden.'
			});
		}

		// Check if player is already in group
		const groupRepo = new GroupRepository(user.id);
		const group = await groupRepo.getById(groupId);
		if (group?.players.some((p) => p.id === player.id)) {
			return fail(400, { error: 'Spieler ist bereits in der Gruppe.' });
		}

		// Add player to group
		const added = await groupRepo.addMember(groupId, player.id);
		if (!added) {
			return fail(403, { error: 'Nicht berechtigt, diesen Spieler hinzuzufügen.' });
		}

		return { success: true };
	},

	createLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerName = formData.get('playerName') as string;

		if (!playerName || playerName.trim() === '') {
			return fail(400, { error: 'Bitte einen Namen eingeben.' });
		}

		const groupId = params.group;

		// Create new local player
		// Use UUID as name for local players (internal identifier)
		const username = crypto.randomUUID();

		const playerRepo = new PlayerRepository(user.id);
		const groupRepo = new GroupRepository(user.id);
		const newPlayer = await playerRepo.create({
			name: username,
			displayName: playerName.trim(),
			authProvider: AuthProvider.Local,
			authProviderId: null
		});

		// Add to group
		await groupRepo.addMember(groupId, newPlayer.id);

		return { success: true };
	},

	removePlayer: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;

		if (!playerId) {
			return fail(400, { error: 'Spieler ID fehlt.' });
		}

		const groupId = params.group;
		const groupRepo = new GroupRepository(user.id);

		// Get player info to check if local
		const playerRepo = new PlayerRepository(user.id);
		const player = await playerRepo.getById(playerId);

		if (!player) {
			return fail(404, { error: 'Spieler nicht gefunden.' });
		}

		// Remove from group
		const success_remove = await groupRepo.removeMember(groupId, playerId);
		let success_delete = true;
		// If local player, delete completely
		if (player.authProvider === AuthProvider.Local) {
			success_delete = await playerRepo.delete(playerId);
		}

		return { success: success_remove && success_delete };
	}
};
