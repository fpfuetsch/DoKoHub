import { db } from '$lib/server/db';
import {
	GroupMemberTable,
	PlayerTable,
	GameParticipantTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable
} from '$lib/server/db/schema';
import type { AuthProviderType } from '$lib/server/enums';
import { and, eq } from 'drizzle-orm';
import { Player } from '$lib/domain/player';
import type { PlayerType } from '$lib/server/db/schema';
import { AuthProvider } from '$lib/server/enums';

export class PlayerRepository {
	constructor(private readonly principalId?: string) {}

	/**
	 * Transfer all references from a local player to an existing non-local player and delete the local player.
	 * Only allowed when caller is authorized for the given group (member of the group).
	 * This operation runs inside a single transaction.
	 */
	async takeoverLocalPlayer(
		localPlayerId: string,
		targetPlayerId: string,
		groupId: string
	): Promise<boolean> {
		if (!this.principalId) throw new Error('Nicht autorisiert.');

		// Authorization: caller must be member of the group
		const authRow = await db
			.select({})
			.from(GroupMemberTable)
			.where(
				and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, this.principalId))
			)
			.limit(1);
		if (authRow.length === 0) throw new Error('Nicht berechtigt, in dieser Gruppe zu handeln.');

		const local = await this.getById(localPlayerId);
		const target = await this.getById(targetPlayerId);
		if (!local || !target) throw new Error('Spieler nicht gefunden.');
		if (local.authProvider !== AuthProvider.Local)
			throw new Error('Quellspieler ist kein lokaler Spieler.');
		if (target.authProvider === AuthProvider.Local)
			throw new Error('Zielspieler darf kein lokaler Spieler sein.');

		try {
			await db.transaction(async (tx) => {
				// First validation: target must not have participated in any of the same games as the local player
				const localGameRows = await tx
					.select()
					.from(GameParticipantTable)
					.where(eq(GameParticipantTable.playerId, localPlayerId));
				const localGameIds = Array.from(new Set(localGameRows.map((r: any) => r.gameId as string)));
				if (localGameIds.length > 0) {
					for (const gid of localGameIds) {
						const rows = await tx
							.select()
							.from(GameParticipantTable)
							.where(
								and(
									eq(GameParticipantTable.gameId, gid),
									eq(GameParticipantTable.playerId, targetPlayerId)
								)
							)
							.limit(1);
						if (rows.length > 0) {
							throw new Error(
								'Du hast bereits mit dem lokalen Spieler in einem Spiel teilgenommen. Übernahme nicht möglich.'
							);
						}
					}
				}
				// Second validation: target must not have participated in any of the same rounds as the local player
				const localRoundRows = await tx
					.select()
					.from(GameRoundParticipantTable)
					.where(eq(GameRoundParticipantTable.playerId, localPlayerId));
				const localRoundIds = Array.from(
					new Set(localRoundRows.map((r: any) => r.roundId as string))
				);
				if (localRoundIds.length > 0) {
					for (const rid of localRoundIds) {
						const rows = await tx
							.select()
							.from(GameRoundParticipantTable)
							.where(
								and(
									eq(GameRoundParticipantTable.roundId, rid),
									eq(GameRoundParticipantTable.playerId, targetPlayerId)
								)
							)
							.limit(1);
						if (rows.length > 0) {
							throw new Error(
								'Du hast bereits mit dem lokalen Spieler in einer Runde teilgenommen. Übernahme nicht möglich.'
							);
						}
					}
				}

				// Transfer group memberships: for each group where local is member,
				// if target already member, remove local entry, otherwise update to target.
				const localGroups = await tx
					.select()
					.from(GroupMemberTable)
					.where(eq(GroupMemberTable.playerId, localPlayerId));

				for (const row of localGroups) {
					const groupIdRow = row.groupId as string;
					const targetExists = await tx
						.select()
						.from(GroupMemberTable)
						.where(
							and(
								eq(GroupMemberTable.groupId, groupIdRow),
								eq(GroupMemberTable.playerId, targetPlayerId)
							)
						)
						.limit(1);

					if (targetExists.length > 0) {
						await tx
							.delete(GroupMemberTable)
							.where(
								and(
									eq(GroupMemberTable.groupId, groupIdRow),
									eq(GroupMemberTable.playerId, localPlayerId)
								)
							);
					} else {
						await tx
							.update(GroupMemberTable)
							.set({ playerId: targetPlayerId })
							.where(
								and(
									eq(GroupMemberTable.groupId, groupIdRow),
									eq(GroupMemberTable.playerId, localPlayerId)
								)
							);
					}
				}

				// Update all game related tables that reference playerId
				await tx
					.update(GameParticipantTable)
					.set({ playerId: targetPlayerId })
					.where(eq(GameParticipantTable.playerId, localPlayerId));

				await tx
					.update(GameRoundParticipantTable)
					.set({ playerId: targetPlayerId })
					.where(eq(GameRoundParticipantTable.playerId, localPlayerId));

				await tx
					.update(GameRoundCallTable)
					.set({ playerId: targetPlayerId })
					.where(eq(GameRoundCallTable.playerId, localPlayerId));

				await tx
					.update(GameRoundBonusTable)
					.set({ playerId: targetPlayerId })
					.where(eq(GameRoundBonusTable.playerId, localPlayerId));

				await tx
					.update(GameRoundResultTable)
					.set({ playerId: targetPlayerId })
					.where(eq(GameRoundResultTable.playerId, localPlayerId));

				// Finally delete the local player
				await tx.delete(PlayerTable).where(eq(PlayerTable.id, localPlayerId));
			});
			return true;
		} catch (e) {
			if (e instanceof Error) throw e;
			throw new Error('Übernahme fehlgeschlagen.');
		}
	}

	async getById(id: string): Promise<Player | null> {
		const result = await db.select().from(PlayerTable).where(eq(PlayerTable.id, id)).limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async getByProvider(provider: AuthProviderType, providerId: string): Promise<Player | null> {
		const result = await db
			.select()
			.from(PlayerTable)
			.where(
				and(eq(PlayerTable.authProviderId, providerId), eq(PlayerTable.authProvider, provider))
			)
			.limit(1);
		if (result.length === 0) return null;
		return new Player(result[0] as PlayerType);
	}

	async create(data: Omit<PlayerType, 'id' | 'createdAt'>): Promise<Player> {
		const [inserted] = await db.insert(PlayerTable).values(data).returning();
		return new Player(inserted as PlayerType);
	}

	async update(
		id: string,
		data: Partial<Omit<PlayerType, 'id' | 'createdAt'>>
	): Promise<Player | null> {
		// Only allow updating own profile
		if (this.principalId && id !== this.principalId) {
			return null;
		}
		const [updated] = await db
			.update(PlayerTable)
			.set(data)
			.where(eq(PlayerTable.id, id))
			.returning();
		return updated ? new Player(updated as PlayerType) : null;
	}

	async delete(id: string, groupId?: string): Promise<boolean> {
		// Only allow deleting local players
		const player = await this.getById(id);
		if (!player || player.authProvider !== AuthProvider.Local) {
			return false;
		}

		// Authorization: only if caller is a member of the provided group
		const canDeleteInGroup =
			this.principalId && groupId ? await this.isMemberOfGroup(groupId) : false;

		if (!canDeleteInGroup) {
			return false;
		}

		const result = await db.delete(PlayerTable).where(eq(PlayerTable.id, id)).returning();
		return result.length > 0;
	}

	async updateLocalDisplayName(id: string, groupId: string, displayName: string): Promise<boolean> {
		if (!this.principalId) return false;
		const authorized = await this.isMemberOfGroup(groupId);
		if (!authorized) return false;

		const player = await this.getById(id);
		if (!player) return false;
		if (player.authProvider !== AuthProvider.Local) return false;

		const result = await db
			.update(PlayerTable)
			.set({ displayName })
			.where(eq(PlayerTable.id, id))
			.returning();
		return result.length > 0;
	}

	/**
	 * Returns true when the player has any game or round participations.
	 */
	async hasParticipations(id: string): Promise<boolean> {
		const gp = await db
			.select()
			.from(GameParticipantTable)
			.where(eq(GameParticipantTable.playerId, id))
			.limit(1);
		if (gp.length > 0) return true;
		const gr = await db
			.select()
			.from(GameRoundParticipantTable)
			.where(eq(GameRoundParticipantTable.playerId, id))
			.limit(1);
		return gr.length > 0;
	}

	private async isMemberOfGroup(groupId: string): Promise<boolean> {
		if (!this.principalId) return false;
		const result = await db
			.select({})
			.from(GroupMemberTable)
			.where(
				and(eq(GroupMemberTable.groupId, groupId), eq(GroupMemberTable.playerId, this.principalId))
			)
			.limit(1);
		return result.length > 0;
	}
}
