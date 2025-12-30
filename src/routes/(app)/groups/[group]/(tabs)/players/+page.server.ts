import { PlayerRepository } from '$lib/repositories/player';
import { GroupRepository } from '$lib/repositories/group';
import { db } from '$lib/server/db';
import { GroupMemberTable } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { sql, eq, and } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const playerRepo = new PlayerRepository();
	const allPlayers = await playerRepo.getAll();
	return { allPlayers };
};

export const actions: Actions = {
	addExisting: async ({ params, request }) => {
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;

		if (!playerId) {
			return fail(400, { error: 'Bitte einen Spieler auswählen.' });
		}

		const groupId = params.group;

		// Check if player is already in group
		const groupRepo = new GroupRepository();
		const group = await groupRepo.getById(groupId);
		if (group?.players.some((p) => p.id === playerId)) {
			return fail(400, { error: 'Spieler ist bereits in der Gruppe.' });
		}

		// Add player to group
		await db.insert(GroupMemberTable).values({ groupId, playerId });

		return { success: true };
	},

	createLocal: async ({ params, request }) => {
		const formData = await request.formData();
		const playerName = formData.get('playerName') as string;

		if (!playerName || playerName.trim() === '') {
			return fail(400, { error: 'Bitte einen Namen eingeben.' });
		}

		const groupId = params.group;

		// Create new local player
		// Use UUID as name for local players (internal identifier)
		const username = crypto.randomUUID();

		const playerRepo = new PlayerRepository();
		const newPlayer = await playerRepo.create({
			name: username,
			displayName: playerName.trim(),
			authProvider: 'local',
			authProviderId: null
		});

		// Add to group
		await db.insert(GroupMemberTable).values({ groupId, playerId: newPlayer.id });

		return { success: true };
	},

	removePlayer: async ({ params, request }) => {
		const formData = await request.formData();
		const playerId = formData.get('playerId') as string;

		if (!playerId) {
			return fail(400, { error: 'Spieler ID fehlt.' });
		}

		const groupId = params.group;

		// Get player info to check if local
		const playerRepo = new PlayerRepository();
		const player = await playerRepo.getById(playerId);

		if (!player) {
			return fail(404, { error: 'Spieler nicht gefunden.' });
		}

		// Remove from group
		await db.delete(GroupMemberTable)
			.where(sql`${GroupMemberTable.groupId} = ${groupId} AND ${GroupMemberTable.playerId} = ${playerId}`);

		// If local player, delete completely
		if (player.authProvider === 'local') {
			await playerRepo.delete(playerId);
		}

		return { success: true };
	}
};
