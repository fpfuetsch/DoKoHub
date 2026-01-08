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

	removeLocalPlayer: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;

		if (!playerId) {
			return fail(400, { error: 'Spieler ID fehlt.' });
		}

		const groupId = params.group;
		const groupRepo = new GroupRepository(user.id);
		const playerRepo = new PlayerRepository(user.id);

		// Verify current user is a member of the group
		const group = await groupRepo.getById(groupId);
		if (!group?.players.some((p) => p.id === user.id)) {
			return fail(400, { error: 'Du bist nicht Mitglied dieser Gruppe.' });
		}

		// Get player info to check if local
		const player = await playerRepo.getById(playerId);

		if (!player) {
			return fail(404, { error: 'Spieler nicht gefunden.' });
		}

		if (player.authProvider !== AuthProvider.Local) {
			return fail(400, { error: 'Nur lokale Spieler können auf diese Weise gelöscht werden.' });
		}

		// If local player, ensure they have no participations before deleting
		const hasParts = await playerRepo.hasParticipations(playerId);
		if (hasParts) {
			return fail(400, {
				error: 'Lokaler Spieler war an Spielen/Runden beteiligt. Lösche entweder zuerst alle betreffenden Spiele oder verknüpfe den lokalen Spieler mit einem Account.'
			});
		}

		// Remove from group
		const success_remove = await groupRepo.removeMember(groupId, playerId);
		// Delete local player completely (authorized because current user is in this group)
		const success_delete = await playerRepo.delete(playerId, groupId);

		return { success: success_remove && success_delete };
	},

	// Current user leaves the group
	leaveGroup: async ({ params, locals }) => {
		const user = requireUserOrFail({ locals });
		const groupId = params.group;

		const groupRepo = new GroupRepository(user.id);

		// Verify player is in the group
		const group = await groupRepo.getById(groupId);
		if (!group?.players.some((p) => p.id === user.id)) {
			return fail(400, { error: 'Du bist nicht Mitglied dieser Gruppe.' });
		}

		// Check if this is the last non-local player
		const nonLocalPlayers = group.players.filter((p) => p.authProvider !== AuthProvider.Local);
		const isLastNonLocalPlayer = nonLocalPlayers.length === 1;

		if (isLastNonLocalPlayer) {
			// Delete all local players first
			const localPlayers = group.players.filter((p) => p.authProvider === AuthProvider.Local);
			const playerRepo = new PlayerRepository(user.id);
			for (const localPlayer of localPlayers) {
				const success = await playerRepo.delete(localPlayer.id, groupId);
				if (!success) {
					return fail(400, { error: 'Fehler beim Löschen lokaler Spieler.' });
				}
			}

			// Delete the entire group
			const success = await groupRepo.delete(groupId);
			if (!success) {
				return fail(400, { error: 'Fehler beim Löschen der Gruppe.' });
			}
			return { success: true, leftGroup: true, deletedGroup: true };
		} else {
			// Remove from group
			const success = await groupRepo.removeMember(groupId, user.id);
			if (!success) {
				return fail(400, { error: 'Fehler beim Verlassen der Gruppe.' });
			}
			return { success: true, leftGroup: true };
		}
	},
	takeoverLocal: async ({ params, request, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const localPlayerId = formData.get('localPlayerId') as string;
		const username = (formData.get('username') as string)?.trim();

		if (!localPlayerId || !username) {
			return fail(400, { error: 'Daten fehlen.' });
		}

		const playerRepo = new PlayerRepository(user.id);
		try {
			const target = await playerRepo.getByName(username);
			if (!target) {
				return fail(404, { error: 'Account nicht gefunden.' });
			}

			await playerRepo.takeoverLocalPlayer(localPlayerId, target.id, params.group!);
			return { success: true };
		} catch (e) {
			if (e instanceof Error) return fail(400, { error: e.message });
			return fail(400, { error: 'Übernahme fehlgeschlagen.' });
		}
	},
};
