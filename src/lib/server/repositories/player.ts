import { db } from '$lib/server/db';
import {
	GroupMemberTable,
	PlayerTable,
	GameParticipantTable,
	GameRoundParticipantTable,
	GameRoundCallTable,
	GameRoundBonusTable,
	GameRoundResultTable,
	PlayerDisplayNameSchema
} from '$lib/server/db/schema';
import type { AuthProviderType } from '$lib/server/enums';
import { and, eq } from 'drizzle-orm';
import { Player } from '$lib/domain/player';
import { BaseRepository } from '$lib/server/repositories/base';
import type { PlayerType } from '$lib/server/db/schema';
import { AuthProvider } from '$lib/server/enums';
import { err, ok, type RepoResult, type RepoVoidResult } from '$lib/server/repositories/result';

export class PlayerRepository extends BaseRepository {
	private readonly principalId?: string;

	constructor(principalId?: string) {
		super();
		this.principalId = principalId;
	}

	protected getPrincipalId(): string | undefined {
		return this.principalId;
	}

	/**
	 * Transfer all references from a local player to the current principal and delete the local player.
	 * Only allowed when caller is authorized for the given group (member of the group).
	 * This operation runs inside a single transaction.
	 */
	async takeoverLocalPlayer(localPlayerId: string, groupId: string): Promise<RepoVoidResult> {
		const membership = await this.ensureGroupMembership(groupId);
		if (!membership.ok) return membership;

		const local = await this.getById(localPlayerId);
		const target = await this.getById(this.principalId!);
		if (!local || !target) return err('Spieler nicht gefunden.');
		if (local.authProvider !== AuthProvider.Local)
			return err('Quellspieler ist kein lokaler Spieler.');
		if (target.authProvider === AuthProvider.Local)
			return err('Zielspieler darf kein lokaler Spieler sein.');

		try {
			await db.transaction(async (tx) => {
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
									eq(GameParticipantTable.playerId, this.principalId!)
								)
							)
							.limit(1);
						if (rows.length > 0) {
							throw new Error(
								'Du hast bereits mit dem lokalen Spieler an einem Spiel teilgenommen. Übernahme nicht möglich.'
							);
						}
					}
				}
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
									eq(GameRoundParticipantTable.playerId, this.principalId!)
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
								eq(GroupMemberTable.playerId, this.principalId!)
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
							.set({ playerId: this.principalId! })
							.where(
								and(
									eq(GroupMemberTable.groupId, groupIdRow),
									eq(GroupMemberTable.playerId, localPlayerId)
								)
							);
					}
				}

				await tx
					.update(GameParticipantTable)
					.set({ playerId: this.principalId! })
					.where(eq(GameParticipantTable.playerId, localPlayerId));

				await tx
					.update(GameRoundParticipantTable)
					.set({ playerId: this.principalId! })
					.where(eq(GameRoundParticipantTable.playerId, localPlayerId));

				await tx
					.update(GameRoundCallTable)
					.set({ playerId: this.principalId! })
					.where(eq(GameRoundCallTable.playerId, localPlayerId));

				await tx
					.update(GameRoundBonusTable)
					.set({ playerId: this.principalId! })
					.where(eq(GameRoundBonusTable.playerId, localPlayerId));

				await tx
					.update(GameRoundResultTable)
					.set({ playerId: this.principalId! })
					.where(eq(GameRoundResultTable.playerId, localPlayerId));

				await tx.delete(PlayerTable).where(eq(PlayerTable.id, localPlayerId));
			});
			return ok();
		} catch (e) {
			if (e instanceof Error) return err(e.message);
			return err('Übernahme fehlgeschlagen.');
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

	async createLocal(displayName: string, groupId: string): Promise<RepoResult<Player>> {
		const membership = await this.ensureGroupMembership(groupId);
		if (!membership.ok) return membership as RepoResult<Player>;

		const validationResult = this.validateDisplayName(displayName);
		if (!validationResult.ok) return validationResult as RepoResult<Player>;

		const [inserted] = await db
			.insert(PlayerTable)
			.values({
				displayName: validationResult.value,
				authProvider: AuthProvider.Local,
				authProviderId: null
			})
			.returning();

		await db.insert(GroupMemberTable).values({ groupId, playerId: inserted.id });
		return ok(new Player(inserted as PlayerType));
	}

	async rename(displayName: string): Promise<RepoVoidResult> {
		const principalCheck = this.requirePrincipal();
		if (!principalCheck.ok) return principalCheck;

		const validationResult = this.validateDisplayName(displayName);
		if (!validationResult.ok) return validationResult;

		return this.updatePlayerDisplayName(this.principalId!, validationResult.value);
	}

	async deleteLocal(
		id: string,
		groupId: string,
		checkParticipations = true
	): Promise<RepoVoidResult> {
		const membership = await this.ensureGroupMembership(groupId);
		if (!membership.ok) return membership;

		const playerCheck = await this.ensureLocalPlayer(id);
		if (!playerCheck.ok) return playerCheck;

		if (checkParticipations) {
			const hasParts = await this.hasParticipations(id);
			if (hasParts) {
				return err(
					'Lokaler Spieler war an Spielen/Runden beteiligt. Lösche entweder zuerst alle betreffenden Spiele oder übernehme den lokalen Spieler.'
				);
			}
		}

		return this.deletePlayerById(id);
	}

	async renameLocal(id: string, groupId: string, displayName: string): Promise<RepoVoidResult> {
		const membership = await this.ensureGroupMembership(groupId);
		if (!membership.ok) return membership;

		const playerCheck = await this.ensureLocalPlayer(id);
		if (!playerCheck.ok) return playerCheck;

		const validationResult = this.validateDisplayName(displayName);
		if (!validationResult.ok) return validationResult;

		return this.updatePlayerDisplayName(id, validationResult.value);
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

	private async ensureLocalPlayer(id: string): Promise<RepoVoidResult> {
		const player = await this.getById(id);
		if (!player) return err('Spieler nicht gefunden.', 404);
		if (player.authProvider !== AuthProvider.Local) {
			return err('Nur lokale Spieler können bearbeitet werden.');
		}
		return ok();
	}

	private validateDisplayName(displayName: string): RepoResult<string> {
		const parsed = PlayerDisplayNameSchema.safeParse(displayName?.trim());
		if (!parsed.success) {
			return err(parsed.error.issues[0]?.message || 'Bitte einen gültigen Anzeigenamen eingeben.');
		}
		return ok(parsed.data);
	}

	private async updatePlayerDisplayName(id: string, displayName: string): Promise<RepoVoidResult> {
		const result = await db
			.update(PlayerTable)
			.set({ displayName })
			.where(eq(PlayerTable.id, id))
			.returning();
		if (result.length === 0) return err('Fehler beim Aktualisieren des Namens.');
		return ok();
	}

	private async deletePlayerById(id: string): Promise<RepoVoidResult> {
		const result = await db.delete(PlayerTable).where(eq(PlayerTable.id, id)).returning();
		if (result.length === 0) return err('Fehler beim Löschen des Spielers.');
		return ok();
	}
}
